import { TestBed } from '@angular/core/testing';

import { Instance } from '../models/reactome-instance.model';
import { EventCycleCheck } from './event-cycle-check.service';

/**
 * What is left of the edit-time circular reference check after the expensive part was removed.
 *
 * It used to refuse containment at any depth too, by walking up the edited event's hasEvent
 * referrers. That cost a request per ancestor on every hasEvent edit, and had to refuse the edit
 * whenever the ancestry could not be read, so a network blip blocked legitimate curation. Cycles
 * are now created freely and reported afterwards by the event view - the one place that needs the
 * hierarchy to be a hierarchy - which is covered by InstanceUtilities'
 * mergeLocalChangesToEventTree tests and the backend's CurationRepositoryEventTreeCycleTest.
 *
 * So the contract here is narrow on purpose: refuse what a dbId comparison can settle, look
 * nothing up, and leave everything else to the event view. The tests below are mostly about the
 * second of those - this service must not acquire a dependency that makes an edit wait again.
 *
 * Note what is deliberately *not* refused: a precedingEvent cycle between two or more different
 * events. Those are ordinary biology and the curation database is full of them - 593 events sit in
 * a two-event precedingEvent cycle - so refusing them would block edits curators legitimately
 * make. Only an event preceding itself is refused.
 */
describe('EventCycleCheck', () => {
  let check: EventCycleCheck;

  function event(dbId: number, displayName: string): Instance {
    return { dbId, displayName, schemaClassName: 'Pathway', attributes: new Map<string, any>() };
  }

  beforeEach(() => {
    // No providers but the service itself: it must not need anything that could make an edit wait.
    TestBed.configureTestingModule({ providers: [EventCycleCheck] });
    check = TestBed.inject(EventCycleCheck);
  });

  it('refuses an event added to its own hasEvent', () => {
    const message = check.checkAddition(event(1, 'Signal transduction'), 'hasEvent',
      [{ dbId: 1, displayName: 'Signal transduction' }]);

    expect(message).toContain('cannot be its own hasEvent');
    expect(message).toContain('Signal transduction [1]');
  });

  it('refuses an event added to its own precedingEvent', () => {
    expect(check.checkAddition(event(1, 'A reaction'), 'precedingEvent', { dbId: 1, displayName: 'A reaction' }))
      .toContain('cannot be its own precedingEvent');
  });

  it('allows a different event as precedingEvent, however the two are related', () => {
    // A precedingEvent cycle between different events is ordinary biology.
    expect(check.checkAddition(event(1, 'A reaction'), 'precedingEvent', [{ dbId: 2, displayName: 'Another reaction' }]))
      .toBeUndefined();
  });

  it('allows an event added under a pathway that already contains it', () => {
    // The case this service used to refuse, at the cost of a request per ancestor. Adding
    // Metabolism to Glycolysis' hasEvent when Metabolism already contains Glycolysis is a genuine
    // circular reference - it is simply not this service's job any more, and cannot be answered
    // here without a lookup. The event view reports it once the hierarchy is built.
    expect(check.checkAddition(event(20, 'Glycolysis'), 'hasEvent', [{ dbId: 10, displayName: 'Metabolism' }]))
      .toBeUndefined();
  });

  it('leaves attributes other than hasEvent and precedingEvent alone', () => {
    // Only these two make an event contain or follow itself. Nothing else is this check's
    // business - a Pathway legitimately refers to itself elsewhere (e.g. its own summation's
    // literatureReference chain), and guessing would block real edits.
    expect(check.checkAddition(event(1, 'Signal transduction'), 'hasMember',
      [{ dbId: 1, displayName: 'Signal transduction' }])).toBeUndefined();
  });

  it('says nothing when there is no instance or no value', () => {
    expect(check.checkAddition(undefined, 'hasEvent', [{ dbId: 1 }])).toBeUndefined();
    expect(check.checkAddition(event(1, 'A pathway'), 'hasEvent', [])).toBeUndefined();
    expect(check.checkAddition(event(1, 'A pathway'), 'hasEvent', undefined)).toBeUndefined();
  });

  describe('for a batch edit', () => {
    it('reports only the instances the value would put inside themselves', () => {
      // A batch edit puts one value on many instances at once, so the value is its own dbId for
      // exactly one of them.
      const refusals = check.checkAdditions(
        [event(10, 'Metabolism'), event(20, 'Glycolysis'), event(30, 'Disease')],
        'hasEvent', [{ dbId: 20, displayName: 'Glycolysis' }]);

      expect([...refusals.keys()]).toEqual([20]);
      expect(refusals.get(20)).toContain('cannot be its own hasEvent');
    });

    it('refuses nothing for an attribute that cannot be circular', () => {
      expect(check.checkAdditions([event(20, 'Glycolysis')], 'hasMember', [{ dbId: 20 }]).size).toBe(0);
    });
  });

  it('answers without a round trip, so an edit is never left waiting', () => {
    // The point of the change: checkAddition/checkAdditions return a value rather than an
    // observable, so no call site can reintroduce a per-edit request by awaiting this.
    expect(typeof check.checkAddition(event(1, 'A pathway'), 'hasEvent', [{ dbId: 1 }])).toBe('string');
    expect(check.checkAdditions([event(1, 'A pathway')], 'hasEvent', [{ dbId: 1 }])).toEqual(jasmine.any(Map));
  });
});
