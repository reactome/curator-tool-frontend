import { TestBed } from '@angular/core/testing';

import { Instance } from '../models/reactome-instance.model';
import { DataService } from './data.service';
import { EventCycleCheck } from './event-cycle-check.service';

/**
 * docs/TODO.md, flagged high importance: "Add a check for event tree to see if there is any
 * circular reference" and "Add a check for circular reference (e.g. precedingEvent)". A cycle in
 * hasEvent is meaningless as a hierarchy and hangs the tree, which walks hasEvent recursively.
 *
 * Note what is deliberately *not* refused: a precedingEvent cycle between two or more different
 * events. Those are ordinary biology and the curation database is full of them - 593 events sit in
 * a two-event precedingEvent cycle - so refusing them would block edits curators legitimately
 * make. Only an event preceding itself is refused (the database holds 7 of those, all errors).
 */
describe('EventCycleCheck', () => {
  let check: EventCycleCheck;
  let dataService: jasmine.SpyObj<DataService>;

  /** An event as the event tree holds it: attributes as a plain object. */
  function treeEvent(dbId: number, displayName: string, children: Instance[] = []): Instance {
    return {
      dbId, displayName, schemaClassName: 'Pathway',
      attributes: children.length > 0 ? { hasEvent: children } : {},
    };
  }

  /** An event as the cache holds it: attributes as a Map. */
  function cachedEvent(dbId: number, displayName: string, children: Instance[] = []): Instance {
    return {
      dbId, displayName, schemaClassName: 'Pathway',
      attributes: new Map<string, any>(children.length > 0 ? [['hasEvent', children]] : []),
    };
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', ['getLoadedEventTree']);
    dataService.getLoadedEventTree.and.returnValue(undefined);

    TestBed.configureTestingModule({
      providers: [EventCycleCheck, { provide: DataService, useValue: dataService }]
    });
    check = TestBed.inject(EventCycleCheck);
  });

  describe('with no event tree loaded', () => {
    it('refuses an event added to its own hasEvent', () => {
      const pathway = cachedEvent(1, 'Signal transduction');

      const message = check.checkAddition(pathway, 'hasEvent', [{ dbId: 1, displayName: 'Signal transduction' }]);

      expect(message).toContain('cannot be its own hasEvent');
      expect(message).toContain('Signal transduction [1]');
    });

    it('refuses an event added to its own precedingEvent', () => {
      const reaction = cachedEvent(1, 'A reaction');

      expect(check.checkAddition(reaction, 'precedingEvent', { dbId: 1, displayName: 'A reaction' }))
        .toContain('cannot be its own precedingEvent');
    });

    it('allows a different event', () => {
      const pathway = cachedEvent(1, 'Signal transduction');

      expect(check.checkAddition(pathway, 'hasEvent', [{ dbId: 2, displayName: 'A sub-pathway' }]))
        .toBeUndefined();
      expect(check.checkAddition(pathway, 'precedingEvent', [{ dbId: 2, displayName: 'An earlier reaction' }]))
        .toBeUndefined();
    });

    it('leaves attributes other than hasEvent and precedingEvent alone', () => {
      // Only these two make an event contain or follow itself. Nothing else is this check's
      // business - a Pathway legitimately refers to itself elsewhere (e.g. its own summation's
      // literatureReference chain), and guessing would block real edits.
      const pathway = cachedEvent(1, 'Signal transduction');

      expect(check.checkAddition(pathway, 'hasMember', [{ dbId: 1, displayName: 'Signal transduction' }]))
        .toBeUndefined();
    });

    it('says nothing when there is no instance or no value', () => {
      expect(check.checkAddition(undefined, 'hasEvent', [{ dbId: 1 }])).toBeUndefined();
      expect(check.checkAddition(cachedEvent(1, 'A pathway'), 'hasEvent', [])).toBeUndefined();
      expect(check.checkAddition(cachedEvent(1, 'A pathway'), 'hasEvent', undefined)).toBeUndefined();
    });
  });

  describe('with the event tree loaded', () => {
    // TopLevelPathway
    //   Metabolism [10]
    //     Glycolysis [20]
    //       Glucose phosphorylation [30]
    //   Disease [40]
    let glycolysis: Instance;

    beforeEach(() => {
      glycolysis = treeEvent(20, 'Glycolysis', [treeEvent(30, 'Glucose phosphorylation')]);
      dataService.getLoadedEventTree.and.returnValue(treeEvent(0, 'TopLevelPathway', [
        treeEvent(10, 'Metabolism', [glycolysis]),
        treeEvent(40, 'Disease'),
      ]));
    });

    it('refuses an event that already contains the one being edited', () => {
      // Adding Metabolism to Glycolysis' hasEvent: Metabolism contains Glycolysis, so Glycolysis
      // would end up inside itself.
      const message = check.checkAddition(cachedEvent(20, 'Glycolysis'), 'hasEvent',
        [{ dbId: 10, displayName: 'Metabolism' }]);

      expect(message).toContain('Metabolism [10]');
      expect(message).toContain('already contains');
      expect(message).toContain('Metabolism > Glycolysis'); // the path, for the curator
    });

    it('refuses an event that contains it further down', () => {
      // Adding Metabolism to Glucose phosphorylation, two levels below it.
      const message = check.checkAddition(cachedEvent(30, 'Glucose phosphorylation'), 'hasEvent',
        [{ dbId: 10, displayName: 'Metabolism' }]);

      expect(message).toContain('Metabolism > Glycolysis > Glucose phosphorylation');
    });

    it('allows an event from elsewhere in the tree', () => {
      // Disease does not contain Glycolysis, so Glycolysis may be added under it - an event under
      // more than one parent is normal in Reactome.
      expect(check.checkAddition(cachedEvent(40, 'Disease'), 'hasEvent',
        [{ dbId: 20, displayName: 'Glycolysis' }])).toBeUndefined();
    });

    it('allows an event the tree does not hold', () => {
      // A pathway no top-level pathway leads to cannot be checked for containment; only its
      // self-reference can be, and that is checked above.
      expect(check.checkAddition(cachedEvent(20, 'Glycolysis'), 'hasEvent',
        [{ dbId: 999, displayName: 'An orphan pathway' }])).toBeUndefined();
    });

    it('checks every occurrence of an event, not just the first', () => {
      // Glycolysis also sits under Disease. Adding Disease under Glucose phosphorylation has to be
      // refused via that second occurrence.
      dataService.getLoadedEventTree.and.returnValue(treeEvent(0, 'TopLevelPathway', [
        treeEvent(10, 'Metabolism', [treeEvent(20, 'Glycolysis')]),
        treeEvent(40, 'Disease', [glycolysis]),
      ]));

      expect(check.checkAddition(cachedEvent(30, 'Glucose phosphorylation'), 'hasEvent',
        [{ dbId: 40, displayName: 'Disease' }]))
        .toContain('Disease > Glycolysis > Glucose phosphorylation');
    });

    it('does not hang on a tree that is already circular', () => {
      // Should not be possible, but a cycle from another tab or from the database must not send
      // the check into infinite recursion - the point of the guard.
      const outer = treeEvent(10, 'Metabolism');
      const inner = treeEvent(20, 'Glycolysis', [outer]);
      outer.attributes['hasEvent'] = [inner];
      dataService.getLoadedEventTree.and.returnValue(treeEvent(0, 'TopLevelPathway', [outer]));

      expect(check.checkAddition(cachedEvent(30, 'Glucose phosphorylation'), 'hasEvent',
        [{ dbId: 10, displayName: 'Metabolism' }])).toBeUndefined();
      expect(check.checkAddition(cachedEvent(20, 'Glycolysis'), 'hasEvent',
        [{ dbId: 10, displayName: 'Metabolism' }])).toContain('already contains');
    });

    it('refuses only the offending value out of several selected at once', () => {
      const message = check.checkAddition(cachedEvent(20, 'Glycolysis'), 'hasEvent', [
        { dbId: 40, displayName: 'Disease' },
        { dbId: 10, displayName: 'Metabolism' },
      ]);

      expect(message).toContain('Metabolism [10]');
    });
  });
});
