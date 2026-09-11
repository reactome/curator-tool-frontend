import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { Instance, Referrer } from '../models/reactome-instance.model';
import { DataService } from './data.service';
import { EventCycleCheck } from './event-cycle-check.service';

/**
 * docs/TODO.md, flagged high importance: "Add a check for event tree to see if there is any
 * circular reference" and "Add a check for circular reference (e.g. precedingEvent)". A cycle in
 * hasEvent takes the whole pathway hierarchy down - the backend's getEventTree recurses through
 * hasEvent with no notion of a path - and cannot be repaired from the front end once committed.
 *
 * Containment is decided by walking up the hasEvent referrers rather than by reading the loaded
 * event tree, because the tree is only in memory once EventTreeComponent has fetched it: an edit
 * made from the schema view had no tree to consult, and that is how a cycle was committed.
 *
 * Note what is deliberately *not* refused: a precedingEvent cycle between two or more different
 * events. Those are ordinary biology and the curation database is full of them - 593 events sit in
 * a two-event precedingEvent cycle - so refusing them would block edits curators legitimately
 * make. Only an event preceding itself is refused.
 */
describe('EventCycleCheck', () => {
  let check: EventCycleCheck;
  let dataService: jasmine.SpyObj<DataService>;

  function event(dbId: number, displayName: string): Instance {
    return { dbId, displayName, schemaClassName: 'Pathway', attributes: new Map<string, any>() };
  }

  /**
   * Stands in for the database: which events hold each event in their hasEvent. Anything not
   * listed has no parents, which is how a top-level pathway looks.
   */
  function hierarchy(childDbId2Parents: { [dbId: number]: Instance[] }) {
    dataService.getReferrers.and.callFake((dbId: number): Observable<Referrer[]> => {
      const parents = childDbId2Parents[dbId] ?? [];
      // The real endpoint groups referrers by attribute, and hasEvent is rarely the only group.
      return of([
        { attributeName: 'precedingEvent', referrers: [event(900, 'An unrelated reaction')] },
        ...(parents.length > 0 ? [{ attributeName: 'hasEvent', referrers: parents }] : []),
      ]);
    });
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', ['getReferrers']);
    hierarchy({});

    TestBed.configureTestingModule({
      providers: [EventCycleCheck, { provide: DataService, useValue: dataService }]
    });
    check = TestBed.inject(EventCycleCheck);
  });

  /** The check is asynchronous; every backing observable here is synchronous, so this resolves. */
  function messageFor(instance: Instance | undefined, attributeName: string, values: any): string | undefined {
    let message: string | undefined;
    let emitted = false;
    check.checkAddition(instance, attributeName, values).subscribe(result => {
      message = result;
      emitted = true;
    });
    expect(emitted).withContext('the check did not answer').toBeTrue();
    return message;
  }

  describe('needing no lookup', () => {
    it('refuses an event added to its own hasEvent', () => {
      const pathway = event(1, 'Signal transduction');

      const message = messageFor(pathway, 'hasEvent', [{ dbId: 1, displayName: 'Signal transduction' }]);

      expect(message).toContain('cannot be its own hasEvent');
      expect(message).toContain('Signal transduction [1]');
      expect(dataService.getReferrers).not.toHaveBeenCalled();
    });

    it('refuses an event added to its own precedingEvent', () => {
      expect(messageFor(event(1, 'A reaction'), 'precedingEvent', { dbId: 1, displayName: 'A reaction' }))
        .toContain('cannot be its own precedingEvent');
    });

    it('allows a different event as precedingEvent, however the two are related', () => {
      // A precedingEvent cycle between different events is ordinary biology; only a self-reference
      // is refused, so this must not even look the hierarchy up.
      expect(messageFor(event(1, 'A reaction'), 'precedingEvent', [{ dbId: 2, displayName: 'Another reaction' }]))
        .toBeUndefined();
      expect(dataService.getReferrers).not.toHaveBeenCalled();
    });

    it('leaves attributes other than hasEvent and precedingEvent alone', () => {
      // Only these two make an event contain or follow itself. Nothing else is this check's
      // business - a Pathway legitimately refers to itself elsewhere (e.g. its own summation's
      // literatureReference chain), and guessing would block real edits.
      expect(messageFor(event(1, 'Signal transduction'), 'hasMember', [{ dbId: 1, displayName: 'Signal transduction' }]))
        .toBeUndefined();
      expect(dataService.getReferrers).not.toHaveBeenCalled();
    });

    it('says nothing when there is no instance or no value', () => {
      expect(messageFor(undefined, 'hasEvent', [{ dbId: 1 }])).toBeUndefined();
      expect(messageFor(event(1, 'A pathway'), 'hasEvent', [])).toBeUndefined();
      expect(messageFor(event(1, 'A pathway'), 'hasEvent', undefined)).toBeUndefined();
    });
  });

  describe('walking up the hierarchy', () => {
    // Metabolism [10]
    //   Glycolysis [20]
    //     Glucose phosphorylation [30]
    // Disease [40]
    const metabolism = event(10, 'Metabolism');
    const glycolysis = event(20, 'Glycolysis');
    const phosphorylation = event(30, 'Glucose phosphorylation');
    const disease = event(40, 'Disease');

    beforeEach(() => {
      hierarchy({ 20: [metabolism], 30: [glycolysis] });
    });

    it('refuses an event that already contains the one being edited', () => {
      // Adding Metabolism to Glycolysis' hasEvent: Metabolism contains Glycolysis, so Glycolysis
      // would end up inside itself.
      const message = messageFor(glycolysis, 'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]);

      expect(message).toContain('Metabolism [10]');
      expect(message).toContain('already contains');
      expect(message).toContain('Metabolism > Glycolysis'); // the path, for the curator
    });

    it('refuses an event that contains it further up', () => {
      // Adding Metabolism to Glucose phosphorylation, two levels below it. This is the case the
      // event tree could not answer from the schema view, where nothing had loaded it.
      expect(messageFor(phosphorylation, 'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]))
        .toContain('Metabolism > Glycolysis > Glucose phosphorylation');
    });

    it('allows an event from elsewhere in the hierarchy', () => {
      // Disease does not contain Glycolysis, so Glycolysis may be added under it - an event under
      // more than one parent is normal in Reactome.
      expect(messageFor(disease, 'hasEvent', [{ dbId: 20, displayName: 'Glycolysis' }])).toBeUndefined();
    });

    it('follows every parent of an event, not just the first', () => {
      // Glucose phosphorylation also sits under Disease, and it is that second parent that makes
      // adding Disease below it a cycle.
      hierarchy({ 30: [glycolysis, disease], 20: [metabolism] });

      expect(messageFor(phosphorylation, 'hasEvent', [{ dbId: 40, displayName: 'Disease' }]))
        .toContain('Disease > Glucose phosphorylation');
    });

    it('refuses only the offending value out of several selected at once', () => {
      const message = messageFor(glycolysis, 'hasEvent', [
        { dbId: 40, displayName: 'Disease' },
        { dbId: 10, displayName: 'Metabolism' },
      ]);

      expect(message).toContain('Metabolism [10]');
    });

    it('reads each event above it once, however many routes reach it', () => {
      // Both parents of Glucose phosphorylation sit under Metabolism, so the walk reaches
      // Metabolism twice; a curator's edit should not pay for it twice.
      hierarchy({ 30: [glycolysis, disease], 20: [metabolism], 40: [metabolism] });

      expect(messageFor(phosphorylation, 'hasEvent', [{ dbId: 999, displayName: 'An orphan pathway' }]))
        .toBeUndefined();
      const consulted = dataService.getReferrers.calls.allArgs().map(args => args[0]);
      expect(consulted).toEqual([30, 20, 40, 10]);
    });

    it('terminates on a hierarchy that is already circular', () => {
      // Should not be reachable now, but a cycle committed before this check existed - or made by
      // another client - must not send the walk round for ever.
      hierarchy({ 30: [glycolysis], 20: [metabolism], 10: [glycolysis] });

      expect(messageFor(phosphorylation, 'hasEvent', [{ dbId: 999, displayName: 'An orphan pathway' }]))
        .toBeUndefined();
      expect(messageFor(phosphorylation, 'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]))
        .toContain('already contains');
    });
  });

  describe('when containment cannot be established', () => {
    it('refuses the edit rather than allowing it unchecked', () => {
      // Allowing it is what let a cycle reach the database, and a committed cycle cannot be
      // repaired from here - the hierarchy it would be repaired through no longer loads.
      dataService.getReferrers.and.returnValue(throwError(() => new Error('503 Service Unavailable')));

      const message = messageFor(event(20, 'Glycolysis'), 'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]);

      expect(message).toContain('Could not check');
      expect(message).toContain('has not been made');
    });

    it('stops climbing a hierarchy deeper than any real one', () => {
      // Each event has a fresh parent, so the walk would climb for ever. It must stop and say so:
      // the deepest real ancestry is 13 events, and RxJS silently drops the answer of a
      // synchronous chain hundreds of levels deep, so a walk that kept going could end up never
      // answering at all - no refusal, no edit, no explanation.
      dataService.getReferrers.and.callFake((dbId: number) =>
        of([{ attributeName: 'hasEvent', referrers: [event(dbId + 1, `Ancestor ${dbId + 1}`)] }]));

      expect(messageFor(event(1, 'A reaction'), 'hasEvent', [{ dbId: -5, displayName: 'A new pathway' }]))
        .toContain('Could not check');
      expect(dataService.getReferrers.calls.count()).toBeLessThan(40);
    });
  });

  describe('for a batch edit', () => {
    it('reports which instances of the batch must be refused', () => {
      const metabolism = event(10, 'Metabolism');
      hierarchy({ 20: [metabolism], 30: [metabolism] });

      let refusals: Map<number, string> | undefined;
      check.checkAdditions([event(20, 'Glycolysis'), event(30, 'Gluconeogenesis'), event(40, 'Disease')],
        'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]).subscribe(result => refusals = result);

      expect([...refusals!.keys()]).toEqual([20, 30]);
      expect(refusals!.get(20)).toContain('Metabolism > Glycolysis');
    });

    it('does not look anything up for an attribute that cannot be circular', () => {
      let refusals: Map<number, string> | undefined;
      check.checkAdditions([event(20, 'Glycolysis')], 'hasMember', [{ dbId: 10 }])
        .subscribe(result => refusals = result);

      expect(refusals!.size).toBe(0);
      expect(dataService.getReferrers).not.toHaveBeenCalled();
    });
  });
});
