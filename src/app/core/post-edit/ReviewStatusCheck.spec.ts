import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Instance, ReviewStatus } from '../models/reactome-instance.model';
import { DataService } from '../services/data.service';
import { InstanceUtilities } from '../services/instance.service';
import { ReviewStatusCheck } from './ReviewStatusCheck';

describe('ReviewStatusCheck', () => {
  let check: ReviewStatusCheck;
  let utils: jasmine.SpyObj<InstanceUtilities>;

  const makeEvent = (atts: [string, any][], schemaClassName = 'Reaction'): Instance =>
    ({ dbId: 1, displayName: 'r', schemaClassName, attributes: new Map(atts) } as Instance);

  beforeEach(() => {
    const dataService = jasmine.createSpyObj<DataService>('DataService', ['getSchemaClass']);
    utils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['isSchemaClass', 'addToModifiedAttributes', 'addToPassiveModifiedAttributes']);
    utils.isSchemaClass.and.returnValue(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: utils },
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
      ],
    });
    check = TestBed.inject(ReviewStatusCheck);
  });

  it('gives an event with no reviewStatus three stars when internalReviewed is assigned', () => {
    const event = makeEvent([['internalReviewed', [{ dbId: 5 }]]]);
    expect(check.handleReviewStatus(event, 'internalReviewed')).toBeTrue();
    expect(event.attributes.get('reviewStatus')).toBe(ReviewStatus.threeStar);
    expect(event.attributes.has('previousReviewStatus')).toBeFalse();
    expect(utils.addToModifiedAttributes).toHaveBeenCalledWith('reviewStatus', event);
  });

  it('promotes a one-star event to three stars and records the previous status', () => {
    const event = makeEvent([['internalReviewed', [{ dbId: 5 }]], ['reviewStatus', ReviewStatus.oneStar]]);
    expect(check.handleReviewStatus(event, 'internalReviewed')).toBeTrue();
    expect(event.attributes.get('reviewStatus')).toBe(ReviewStatus.threeStar);
    expect(event.attributes.get('previousReviewStatus')).toBe(ReviewStatus.oneStar);
  });

  it('does not award stars when internalReviewed is emptied', () => {
    const event = makeEvent([['internalReviewed', []]]);
    expect(check.handleReviewStatus(event, 'internalReviewed')).toBeFalse();
    expect(event.attributes.has('reviewStatus')).toBeFalse();
  });

  it('gives an event with no reviewStatus five stars when reviewed is assigned', () => {
    const event = makeEvent([['reviewed', [{ dbId: 6 }]]]);
    expect(check.handleReviewStatus(event, 'reviewed')).toBeTrue();
    expect(event.attributes.get('reviewStatus')).toBe(ReviewStatus.fiveStar);
  });

  it('applies to classes other than Event', () => {
    const inst = makeEvent([['internalReviewed', [{ dbId: 5 }]]], 'Complex');
    expect(check.handleReviewStatus(inst, 'internalReviewed')).toBeTrue();
    expect(inst.attributes.get('reviewStatus')).toBe(ReviewStatus.threeStar);
  });
});
