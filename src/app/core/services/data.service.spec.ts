import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';
import { Store, StoreModule } from '@ngrx/store';

import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  deletedInstancesReducer,
  newInstancesReducer,
  updatedInstancesReducer
} from 'src/app/instance/state/instance.reducers';
import {
  DELETE_INSTANCES_STATE_NAME,
  NEW_INSTANCES_STATE_NAME,
  UPDATE_INSTANCES_STATE_NAME
} from 'src/app/instance/state/instance.selectors';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { Instance, Referrer } from '../models/reactome-instance.model';
import { DataService } from './data.service';
import { InstanceUtilities } from './instance.service';

/**
 * The referrer list a curator is shown - in the referrers dialog, and in the deletion dialog where
 * it is the list of instances the deletion will affect. It comes from the server, which knows
 * nothing about local staging, so instances the curator has marked for deletion have to be taken
 * out of it here, and the instances that refer to the target only locally have to be merged in.
 */
describe('DataService.getReferrers and local staging', () => {
  let service: DataService;
  let store: Store;
  let http: HttpTestingController;

  const TARGET_DB_ID = 100;

  function makeInstance(dbId: number, displayName: string, schemaClassName = 'Pathway'): Instance {
    return { dbId, displayName, schemaClassName, attributes: new Map<string, any>() };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // The real reducers, so that the store gets into its states the way the app does.
        StoreModule.forRoot({
          [UPDATE_INSTANCES_STATE_NAME]: updatedInstancesReducer,
          [NEW_INSTANCES_STATE_NAME]: newInstancesReducer,
          [DELETE_INSTANCES_STATE_NAME]: deletedInstancesReducer,
        }),
      ],
      providers: [
        DataService,
        InstanceUtilities,
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog'])
        },
      ]
    });
    service = TestBed.inject(DataService);
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Asks for the target's referrers and answers the request with what the server would return. */
  function getReferrers(serverAnswer: Referrer[]): Referrer[] {
    let result: Referrer[] = [];
    service.getReferrers(TARGET_DB_ID).subscribe(referrers => result = referrers);
    http.expectOne(request => request.url.endsWith(`getReferrers/${TARGET_DB_ID}`)).flush(serverAnswer);
    return result;
  }

  it('lists what the server returns when nothing is staged', () => {
    const referrers = getReferrers([
      { attributeName: 'hasEvent', referrers: [makeInstance(1, 'A referring pathway')] },
    ]);

    expect(referrers.length).toBe(1);
    expect(referrers[0].referrers.map(inst => inst.dbId)).toEqual([1]);
  });

  it('leaves out a referrer the curator has marked for deletion', () => {
    const deleted = makeInstance(2, 'A pathway marked for deletion');
    store.dispatch(DeleteInstanceActions.register_deleted_instance(deleted));

    const referrers = getReferrers([
      { attributeName: 'hasEvent', referrers: [makeInstance(1, 'A referring pathway'), deleted] },
    ]);

    expect(referrers[0].referrers.map(inst => inst.dbId)).toEqual([1]);
  });

  it('drops an attribute group whose only referrer is marked for deletion', () => {
    const deleted = makeInstance(2, 'A pathway marked for deletion');
    store.dispatch(DeleteInstanceActions.register_deleted_instance(deleted));

    const referrers = getReferrers([
      { attributeName: 'hasEvent', referrers: [deleted] },
      { attributeName: 'precedingEvent', referrers: [makeInstance(1, 'A referring pathway')] },
    ]);

    expect(referrers.map(ref => ref.attributeName)).toEqual(['precedingEvent']);
  });

  it('adds a locally staged referrer the server does not know about', () => {
    // A new pathway that refers to the target: it exists only in the cache, so the server's
    // answer cannot mention it.
    const newPathway = makeInstance(-1, 'A new pathway');
    newPathway.attributes.set('hasEvent', [{ dbId: TARGET_DB_ID, displayName: 'The target' }]);
    service.registerInstance(newPathway);
    store.dispatch(NewInstanceActions.register_new_instance(newPathway));

    const referrers = getReferrers([]);

    expect(referrers.length).toBe(1);
    expect(referrers[0].attributeName).toBe('hasEvent');
    expect(referrers[0].referrers.map(inst => inst.dbId)).toEqual([-1]);
  });

  it('does not add back a staged referrer that is also marked for deletion', () => {
    // The one way a deleted instance could still be listed: it is filtered out of the server's
    // answer, and then added straight back from the cache by the local-referrer pass. The
    // deletion dialogs take an instance out of the updated list when they mark it for deletion,
    // but only if it has modified attributes - and the store is written to from other tabs and
    // from the staged work restored at login too, so the lists can overlap.
    const updatedPathway = makeInstance(2, 'An edited pathway, now marked for deletion');
    updatedPathway.attributes.set('hasEvent', [{ dbId: TARGET_DB_ID, displayName: 'The target' }]);
    service.registerInstance(updatedPathway);
    store.dispatch(UpdateInstanceActions.register_updated_instance(updatedPathway));
    store.dispatch(DeleteInstanceActions.register_deleted_instance(updatedPathway));

    const referrers = getReferrers([
      { attributeName: 'hasEvent', referrers: [updatedPathway] },
    ]);

    expect(referrers).toEqual([]);
  });
});

/**
 * The event tree response, and the circular hasEvent relationships that come with it.
 *
 * Editing hasEvent is no longer refused - establishing what already contains an event cost a
 * request per ancestor on every edit - so `/getEventTree` reports the cyclic relationships it had
 * to drop to build the hierarchy, and the event view tells the curator. That made the endpoint
 * return `{events, cycles}` where it used to return a bare array of top-level events, so this has
 * to read both: a front end deployed ahead of the backend still has to show the tree.
 */
describe('DataService.fetchEventTree', () => {
  let service: DataService;
  let http: HttpTestingController;

  const TOP_EVENTS = [
    { dbId: 10, displayName: 'Metabolism', schemaClassName: 'Pathway', attributes: { hasEvent: [] } },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        StoreModule.forRoot({
          [UPDATE_INSTANCES_STATE_NAME]: updatedInstancesReducer,
          [NEW_INSTANCES_STATE_NAME]: newInstancesReducer,
          [DELETE_INSTANCES_STATE_NAME]: deletedInstancesReducer,
        }),
      ],
      providers: [
        DataService,
        InstanceUtilities,
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog'])
        },
      ]
    });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Fetches the tree and answers the request with what the server would return. */
  function fetchEventTree(serverAnswer: any): Instance {
    let root: Instance | undefined;
    service.fetchEventTree(false, 'all').subscribe(result => root = result);
    http.expectOne(request => request.url.includes('getEventTree/all')).flush(serverAnswer);
    return root!;
  }

  it('reads the events and the cycles out of the response', () => {
    const cycle = { path: [{ dbId: 10, displayName: 'Metabolism' }, { dbId: 20, displayName: 'Glycolysis' }] };

    const root = fetchEventTree({ events: TOP_EVENTS, cycles: [cycle] });

    // The synthetic root the tree is built from, holding the top events unchanged.
    expect(root.dbId).toBe(0);
    expect(root.attributes['hasEvent'].map((event: Instance) => event.dbId)).toEqual([10]);
    expect(service.getEventTreeCycles()).toEqual([cycle]);
  });

  it('reports no cycles for a sound hierarchy', () => {
    fetchEventTree({ events: TOP_EVENTS, cycles: [] });

    expect(service.getEventTreeCycles()).toEqual([]);
  });

  it('still reads a bare array from a backend that does not report cycles', () => {
    // The old wire shape. The tree has to load; there is simply nothing to report.
    const root = fetchEventTree(TOP_EVENTS);

    expect(root.attributes['hasEvent'].map((event: Instance) => event.dbId)).toEqual([10]);
    expect(service.getEventTreeCycles()).toEqual([]);
  });

  it('keeps reporting the cycles of the tree it is handing back from cache', () => {
    // fetchEventTree answers a second caller from its cache without a request, and that caller
    // still has to be told about the cycles in the tree it was given.
    const cycle = { path: [{ dbId: 10, displayName: 'Metabolism' }] };
    fetchEventTree({ events: TOP_EVENTS, cycles: [cycle] });

    let root: Instance | undefined;
    service.fetchEventTree(false, 'all').subscribe(result => root = result);

    expect(root).toBeDefined(); // No request to flush: answered from the cache.
    expect(service.getEventTreeCycles()).toEqual([cycle]);
  });
});
