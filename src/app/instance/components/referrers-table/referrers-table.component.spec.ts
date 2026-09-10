import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { DataService } from 'src/app/core/services/data.service';
import {
  commonTestProviders,
  componentTestImports,
  makeInstance,
  makeReferrer
} from 'src/testing';
import { ReferrersTableComponent } from './referrers-table.component';

describe('ReferrersTableComponent', () => {
  let dataService: jasmine.SpyObj<DataService>;
  let reviewStatusCheck: jasmine.SpyObj<ReviewStatusCheck>;

  const pathway = makeInstance({ dbId: 100, displayName: 'Glycolysis' });
  const reactionA = makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' });
  const reactionB = makeInstance({ dbId: 102, displayName: 'B -> C', schemaClassName: 'Reaction' });

  /**
   * Builds the component for `instance`. The component fetches its referrers from a
   * `setTimeout` in the constructor (to dodge NG0100), so every caller must `tick()`.
   */
  function build(instance: Instance, deletion = false): ReferrersTableComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        ReferrersTableComponent,
        { provide: ReviewStatusCheck, useValue: reviewStatusCheck }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.getReferrers.and.returnValue(of(referrerGroups));
    const component = TestBed.inject(ReferrersTableComponent);
    component.instance = instance;
    component.deletion = deletion;
    return component;
  }

  let referrerGroups: any[];

  beforeEach(() => {
    reviewStatusCheck = jasmine.createSpyObj<ReviewStatusCheck>(
      'ReviewStatusCheck', ['checkChangeReviewStatus', 'handleReviewStatus']);
    reviewStatusCheck.checkChangeReviewStatus.and.returnValue(false);
    // Deliberately out of alphabetical order, to prove the component sorts.
    referrerGroups = [
      makeReferrer('output', [reactionA]),
      makeReferrer('hasEvent', [pathway]),
      makeReferrer('input', [reactionA, reactionB])
    ];
  });

  it('fetches the referrers of the bound instance', fakeAsync(() => {
    build(makeInstance({ dbId: 202 }));
    tick();

    expect(dataService.getReferrers).toHaveBeenCalledWith(202);
  }));

  it('sorts the referrer groups by attribute name', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.instanceList.map(r => r.attributeName))
      .toEqual(['hasEvent', 'input', 'output']);
  }));

  it('totals the referrers across every group', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.totalCount).toEqual(4);
  }));

  it('emits the total so the deletion dialog can show a count', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    const emitted: number[] = [];
    component.numberOfRefs.subscribe(n => emitted.push(n));
    tick();

    expect(emitted).toEqual([4]);
  }));

  it('expands the first group so the dialog does not open entirely collapsed', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.isExpanded('hasEvent')).toBeTrue();
    expect(component.isExpanded('input')).toBeFalse();
  }));

  it('reports a total of zero and expands nothing when there are no referrers', fakeAsync(() => {
    referrerGroups = [];
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.totalCount).toEqual(0);
    expect(component.instanceList).toEqual([]);
  }));

  it('clears the progress spinner once the referrers have arrived', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.showProgressSpinner).toBeFalse();
  }));

  it('toggles a group open and closed', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    component.openTable('input');
    expect(component.isExpanded('input')).toBeTrue();

    component.openTable('input');
    expect(component.isExpanded('input')).toBeFalse();
  }));

  it('never warns about a structural change outside a deletion', fakeAsync(() => {
    // For ordinary edits the display name is what changes, so a review-status warning here
    // would be noise.
    reviewStatusCheck.checkChangeReviewStatus.and.returnValue(true);
    const component = build(makeInstance({ dbId: 202 }), false);
    tick();

    expect(component.isStructuralChange(reactionA)).toBeFalse();
  }));

  it('warns about a referrer whose review status a deletion would change', fakeAsync(() => {
    reviewStatusCheck.checkChangeReviewStatus.and.callFake(
      (inst: Instance) => inst.dbId === 101);
    const component = build(makeInstance({ dbId: 202 }), true);
    tick();

    expect(component.isStructuralChange(reactionA)).toBeTrue();
    expect(component.isStructuralChange(pathway)).toBeFalse();
  }));

  it('checks each referrer against the attribute it is referenced through', fakeAsync(() => {
    build(makeInstance({ dbId: 202 }), true);
    tick();

    expect(reviewStatusCheck.checkChangeReviewStatus)
      .toHaveBeenCalledWith(pathway, 'hasEvent');
    expect(reviewStatusCheck.checkChangeReviewStatus)
      .toHaveBeenCalledWith(reactionA, 'output');
  }));

  it('offers only the launch action, since a referrer list is read-only', fakeAsync(() => {
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    expect(component.actionButtons.map(b => b.name)).toEqual(['launch']);
  }));

  it('opens a referrer in a new tab when launched', fakeAsync(() => {
    const open = spyOn(window, 'open');
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    component.handleAction({ instance: reactionA, action: 'launch' });

    expect(open).toHaveBeenCalledWith('schema_view/instance/101', '_blank');
  }));

  it('opens the instance when its name is clicked, same as the launch button', fakeAsync(() => {
    const open = spyOn(window, 'open');
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    component.navigateUrl(reactionA);

    expect(open).toHaveBeenCalledWith('schema_view/instance/101', '_blank');
  }));

  it('ignores an action it does not handle', fakeAsync(() => {
    const open = spyOn(window, 'open');
    const component = build(makeInstance({ dbId: 202 }));
    tick();

    component.handleAction({ instance: reactionA, action: 'delete' });

    expect(open).not.toHaveBeenCalled();
  }));
});
