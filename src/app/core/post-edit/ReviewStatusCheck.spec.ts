import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Instance, ReviewStatus } from '../models/reactome-instance.model';
import { DataService } from '../services/data.service';
import { InstanceUtilities } from '../services/instance.service';
import { ReviewStatusCheck } from './ReviewStatusCheck';

describe('ReviewStatusCheck', () => {
  let check: ReviewStatusCheck;
  let dataService: jasmine.SpyObj<DataService>;
  let utils: jasmine.SpyObj<InstanceUtilities>;
  let dialog: jasmine.SpyObj<MatDialog>;

  // Slot values are shells, the way the server serializes them, so an InstanceEdit's dateTime is
  // only reachable once the full instance has been loaded into the DataService cache. These two maps
  // keep that distinction: what the server would return, and what has been loaded so far.
  let onServer: Map<number, Instance>;
  let cached: Map<number, Instance>;

  function instanceEdit(dbId: number, dateTime: string, isCached = true): Instance {
    const edit: Instance = {
      dbId,
      schemaClassName: 'InstanceEdit',
      displayName: `edit-${dbId}`,
      attributes: new Map<string, any>([['dateTime', dateTime]]),
    };
    onServer.set(dbId, edit);
    if (isCached)
      cached.set(dbId, edit);
    return { dbId, schemaClassName: 'InstanceEdit', displayName: edit.displayName }; // A shell
  }

  /** An InstanceEdit created locally: a negative dbId, and no dateTime until it is committed. */
  function newInstanceEdit(dbId: number): Instance {
    return { dbId, schemaClassName: 'InstanceEdit', displayName: 'new edit', attributes: new Map() };
  }

  function event(attrs: Record<string, any>): Instance {
    return {
      dbId: 100,
      schemaClassName: 'Pathway',
      displayName: 'a pathway',
      attributes: new Map<string, any>(Object.entries(attrs)),
    };
  }

  beforeEach(() => {
    onServer = new Map<number, Instance>();
    cached = new Map<number, Instance>();
    dataService = jasmine.createSpyObj<DataService>('DataService', [
      'getCachedInstance', 'fetchInstances', 'isEventClass'
    ]);
    dataService.getCachedInstance.and.callFake((dbId: number) => cached.get(dbId));
    dataService.fetchInstances.and.callFake((dbIds: number[]) => {
      const loaded = dbIds.map(dbId => onServer.get(dbId)!).filter(Boolean);
      loaded.forEach(edit => cached.set(edit.dbId, edit));
      return of(loaded);
    });
    dataService.isEventClass.and.returnValue(true);
    utils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities', [
      'addToModifiedAttributes', 'addToPassiveModifiedAttributes', 'isSchemaClass'
    ]);
    utils.isSchemaClass.and.returnValue(false);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    TestBed.configureTestingModule({
      providers: [
        ReviewStatusCheck,
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: utils },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    check = TestBed.inject(ReviewStatusCheck);
  });

  describe('checkReviewStatusDateTimes', () => {
    it('accepts three stars when internalReviewed is later than the last modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        structureModified: [instanceEdit(1, '2020-01-01 10:00:00')],
        internalReviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.threeStar)).toEqual([]);
    });

    it('rejects three stars when internalReviewed predates the last modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        internalReviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
      });
      const issues = check.checkReviewStatusDateTimes(instance, ReviewStatus.threeStar);
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('internalReviewed (2019-06-01 10:00:00)');
      expect(issues[0]).toContain('last modification (2020-01-01 10:00:00)');
    });

    it('rejects three stars when internalReviewed is not assigned', () => {
      const instance = event({ modified: [instanceEdit(1, '2020-01-01 10:00:00')] });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.threeStar))
        .toEqual(['internalReviewed is not assigned.']);
    });

    it('takes the last modification from modified when it is later than structureModified', () => {
      const instance = event({
        structureModified: [instanceEdit(1, '2020-01-01 10:00:00')],
        modified: [instanceEdit(1, '2020-01-01 10:00:00'), instanceEdit(2, '2021-01-01 10:00:00')],
        internalReviewed: [instanceEdit(3, '2020-06-01 10:00:00')],
      });
      const issues = check.checkReviewStatusDateTimes(instance, ReviewStatus.threeStar);
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('last modification (2021-01-01 10:00:00)');
    });

    it('compares against the latest InstanceEdit in a slot, not the first', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        // An old review alongside a current one is fine: the latest is what counts.
        internalReviewed: [instanceEdit(2, '2015-06-01 10:00:00'), instanceEdit(3, '2021-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.threeStar)).toEqual([]);
    });

    it('accepts four stars when internalReviewed is later than both reviewed and the modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2019-01-01 10:00:00')],
        internalReviewed: [instanceEdit(3, '2020-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar)).toEqual([]);
    });

    it('rejects four stars when internalReviewed is earlier than reviewed', () => {
      const instance = event({
        modified: [instanceEdit(1, '2018-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-01-01 10:00:00')],
        internalReviewed: [instanceEdit(3, '2019-06-01 10:00:00')],
      });
      const issues = check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar);
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('is not later than reviewed (2020-01-01 10:00:00)');
    });

    it('rejects four stars when reviewed is not assigned', () => {
      const instance = event({
        modified: [instanceEdit(1, '2018-01-01 10:00:00')],
        internalReviewed: [instanceEdit(2, '2020-01-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar))
        .toEqual(['reviewed is not assigned.']);
    });

    it('accepts five stars when reviewed is later than the last modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('rejects five stars when reviewed predates the last modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
      });
      const issues = check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar);
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('reviewed (2019-06-01 10:00:00)');
    });

    it('does not consult authored for five stars', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        authored: [instanceEdit(2, '2021-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar))
        .toEqual(['reviewed is not assigned.']);
    });

    it('does not check one and two stars, which are not released', () => {
      const instance = event({ modified: [instanceEdit(1, '2020-01-01 10:00:00')] });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.oneStar)).toEqual([]);
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.twoStar)).toEqual([]);
    });

    it('compares dateTimes stored in different formats', () => {
      const instance = event({
        modified: [instanceEdit(1, '20200101100000')], // The 14 digit form
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00.0')], // With fractional seconds
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('treats a newly created review as later than the last modification', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        // It has no dateTime until the server stamps it at commit, after every modification above.
        reviewed: [newInstanceEdit(-5)],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('lets a newly created review outweigh an older one in the same slot', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2019-06-01 10:00:00'), newInstanceEdit(-5)],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('treats a newly created internalReviewed as later than reviewed for four stars', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
        internalReviewed: [newInstanceEdit(-5)],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar)).toEqual([]);
    });

    it('still rejects four stars when only reviewed is newly created', () => {
      const instance = event({
        modified: [instanceEdit(1, '2018-01-01 10:00:00')],
        reviewed: [newInstanceEdit(-5)],
        internalReviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
      });
      const issues = check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar);
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('is not later than reviewed (not yet committed)');
    });

    it('does not treat a newly created InstanceEdit in a modification slot as the latest', () => {
      const instance = event({
        // An uncommitted modification is stamped at the same commit as the review being added, so
        // it cannot be later than it. Only the dateTimes actually recorded count here.
        modified: [newInstanceEdit(-5)],
        reviewed: [instanceEdit(1, '2019-06-01 10:00:00')],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('skips a dateTime it cannot resolve rather than reporting a violation', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        // A committed InstanceEdit that could not be loaded: reviewed is still assigned, so this is
        // an ordering the check cannot judge, not a missing review.
        reviewed: [{ dbId: 999, schemaClassName: 'InstanceEdit', displayName: 'unloadable edit' }],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar)).toEqual([]);
    });

    it('reports a missing review even when the other slot is newly created', () => {
      const instance = event({
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        internalReviewed: [newInstanceEdit(-5)],
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fourStar))
        .toEqual(['reviewed is not assigned.']);
    });

    it('accepts a single valued slot as well as a list', () => {
      const instance = event({
        modified: instanceEdit(1, '2020-01-01 10:00:00'),
        reviewed: instanceEdit(2, '2019-06-01 10:00:00'),
      });
      expect(check.checkReviewStatusDateTimes(instance, ReviewStatus.fiveStar).length).toBe(1);
    });
  });

  describe('handleReviewStatus', () => {
    it('promotes to five stars when reviewed post-dates the last modification', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'reviewed');
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.fiveStar);
      expect(instance.attributes.get('previousReviewStatus')).toBe(ReviewStatus.threeStar);
      expect(utils.addToModifiedAttributes).toHaveBeenCalledWith('reviewStatus', instance);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('leaves the reviewStatus alone and explains when reviewed predates the last modification', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'reviewed');
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.threeStar);
      expect(instance.attributes.has('previousReviewStatus')).toBeFalse();
      expect(utils.addToModifiedAttributes).not.toHaveBeenCalledWith('reviewStatus', instance);
      expect(dialog.open).toHaveBeenCalled();
      const data = (dialog.open.calls.mostRecent().args[1] as any).data;
      expect(data.title).toBe('ReviewStatus Not Promoted');
      expect(data.message).toContain('five stars');
    });

    it('promotes to five stars when the reviewed InstanceEdit has just been created', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00', false)],
        reviewed: [newInstanceEdit(-5)],
      });
      check.handleReviewStatus(instance, 'reviewed');
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.fiveStar);
      // The new InstanceEdit has nothing to load: it only exists locally.
      expect(dataService.fetchInstances).toHaveBeenCalledWith([1]);
    });

    it('promotes to four stars from two stars when internalReviewed is the latest', () => {
      const instance = event({
        reviewStatus: ReviewStatus.twoStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
        internalReviewed: [instanceEdit(3, '2020-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'internalReviewed');
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.fourStar);
    });

    it('promotes to three stars from one star when internalReviewed is the latest', () => {
      const instance = event({
        reviewStatus: ReviewStatus.oneStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        internalReviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'internalReviewed');
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.threeStar);
    });

    it('does not open a dialog for a blocked promotion during a passive edit', () => {
      const instance = event({
        reviewStatus: ReviewStatus.oneStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        internalReviewed: [instanceEdit(2, '2019-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'internalReviewed', false);
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.oneStar);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('loads the InstanceEdits whose dateTime is not cached yet, and only those', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00', false)],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00', false), instanceEdit(3, '2019-01-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'reviewed');
      expect(dataService.fetchInstances).toHaveBeenCalledWith([1, 2]);
      // Loading them is what makes the promotion judgeable at all.
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.fiveStar);
    });

    it('does not fetch anything when every dateTime is already in the cache', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      check.handleReviewStatus(instance, 'reviewed');
      expect(dataService.fetchInstances).not.toHaveBeenCalled();
      expect(instance.attributes.get('reviewStatus')).toBe(ReviewStatus.fiveStar);
    });

    it('notifies the post edit listener once a promotion has been applied', () => {
      const instance = event({
        reviewStatus: ReviewStatus.threeStar,
        modified: [instanceEdit(1, '2020-01-01 10:00:00')],
        reviewed: [instanceEdit(2, '2020-06-01 10:00:00')],
      });
      const listener = jasmine.createSpyObj('PostEditListener', ['donePostEdit']);
      check.handleReviewStatus(instance, 'reviewed', true, listener);
      expect(listener.donePostEdit).toHaveBeenCalledWith(instance, 'reviewStatus');
    });
  });
});
