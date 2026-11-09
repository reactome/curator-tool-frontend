import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
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
import { DataService, NEXT_NEW_DB_ID_STORAGE_KEY } from './data.service';
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
/**
 * After a new instance is committed, every cached reference to its local (negative) dbId has to
 * move to the persisted one, and the cached copy under the local dbId has to go. The server creates
 * a new instance for any negative dbId it is sent, so a leftover one is committed again as a
 * duplicate - e.g. a new Reaction that was already created when its new Pathway was committed.
 */
describe('DataService.remapNewInstanceReferenceDbId', () => {
  let service: DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, StoreModule.forRoot({})],
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
  });

  it('points referrers at the persisted dbId and drops the local copy', () => {
    const reaction: Instance = { dbId: -1, displayName: 'A -> B', schemaClassName: 'Reaction', attributes: new Map() };
    const pathway: Instance = {
      dbId: 50, displayName: 'My pathway', schemaClassName: 'Pathway',
      attributes: new Map<string, any>([['hasEvent', [{ dbId: -1, displayName: 'A -> B', schemaClassName: 'Reaction' }]]])
    };
    service.registerInstance(reaction);
    service.registerInstance(pathway);

    const changed = service.remapNewInstanceReferenceDbId(-1, 200);

    expect(pathway.attributes.get('hasEvent')[0].dbId).toBe(200);
    expect(changed).toEqual([pathway]);
    expect(service.getCachedInstance(-1)).toBeUndefined();
  });

  it('reports a referrer whose shared shell was already moved to the persisted dbId', () => {
    // Adding a new instance to an attribute stores the shared shell, and setCommittedNewInstDbId
    // re-keys it before the remap runs. The referrer must still be reported, or its staged
    // snapshot is never rewritten and a reload brings back the dead local dbId.
    const utils = TestBed.inject(InstanceUtilities);
    const reaction: Instance = { dbId: -1, displayName: 'A -> B', schemaClassName: 'Reaction', attributes: new Map() };
    const pathway: Instance = {
      dbId: 50, displayName: 'My pathway', schemaClassName: 'Pathway',
      attributes: new Map<string, any>([['hasEvent', [utils.getShellInstance(reaction)]]])
    };
    service.registerInstance(reaction);
    service.registerInstance(pathway);

    utils.setCommittedNewInstDbId(-1, 200);
    const changed = service.remapNewInstanceReferenceDbId(-1, 200);

    expect(pathway.attributes.get('hasEvent')[0].dbId).toBe(200);
    expect(changed).toEqual([pathway]);
  });
});

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

/**
 * The Diagram sync QA check (qa/diagramSync) and the diagram lookup that decides whether the
 * instance view offers it at all.
 */
describe('DataService diagram sync check', () => {
  let service: DataService;
  let http: HttpTestingController;
  let errors: Error[];

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
    errors = [];
    service.errorMessage$.subscribe(error => errors.push(error));
  });

  afterEach(() => {
    http.verify();
  });

  it('runs the check against the pathway and hands back the report as sent', () => {
    const report = {
      eventDbId: 1430728,
      eventDisplayName: 'Metabolism',
      checkedDiagrams: 118,
      uncheckedDiagramDbIds: [],
      issues: [{
        diagramDbId: 1430727, pathwayDbId: 1430728, pathwayDisplayName: 'Metabolism',
        eventDbId: 556833, eventDisplayName: 'Metabolism of lipids', eventSchemaClass: 'Pathway',
        issue: 'precedingEvent out of sync: missing 1428517', missingPrecedingEventDbId: 1428517
      }]
    };
    let received: any;

    service.checkDiagramSync(1430728).subscribe(result => received = result);
    const request = http.expectOne(r => r.url.endsWith('/qa/diagramSync/1430728'));
    expect(request.request.method).toBe('GET');
    request.flush(report);

    expect(received).toEqual(report);
  });

  it('reports an unknown dbId through the usual error banner and to the caller', () => {
    let failed: any;

    service.checkDiagramSync(42).subscribe({ error: error => failed = error });
    http.expectOne(r => r.url.endsWith('/qa/diagramSync/42'))
      .flush('Cannot find instance with dbId: 42', { status: 404, statusText: 'Not Found' });

    expect(failed).toBeDefined();
    expect(errors.length).toBe(1);
  });

  it('knows a pathway has a diagram when the server finds one', () => {
    let hasDiagram: boolean | undefined;

    service.hasPathwayDiagram(1430728).subscribe(result => hasDiagram = result);
    http.expectOne(r => r.url.endsWith('/fetchPathwayDiagramForPathway/1430728'))
      .flush({ dbId: 1430727, displayName: 'Diagram of Metabolism', schemaClassName: 'PathwayDiagram' });

    expect(hasDiagram).toBeTrue();
  });

  it('answers false, without an error banner, for a pathway with no diagram', () => {
    // The server answers "no diagram" with a not-found error. Showing that as an error every
    // time a curator opens such a pathway would be noise: it only decides whether a button shows.
    let hasDiagram: boolean | undefined;

    service.hasPathwayDiagram(69615).subscribe(result => hasDiagram = result);
    http.expectOne(r => r.url.endsWith('/fetchPathwayDiagramForPathway/69615'))
      .flush('Cannot find instance with dbId: 69615', { status: 404, statusText: 'Not Found' });

    expect(hasDiagram).toBeFalse();
    expect(errors).toEqual([]);
  });

  it('does not ask the server about a new, uncommitted pathway', () => {
    let hasDiagram: boolean | undefined;

    service.hasPathwayDiagram(-3).subscribe(result => hasDiagram = result);

    expect(hasDiagram).toBeFalse(); // http.verify() confirms no request went out
  });
});

describe('DataService new dbIds', () => {
  let service: DataService;
  let utils: InstanceUtilities;

  beforeEach(() => {
    localStorage.removeItem(NEXT_NEW_DB_ID_STORAGE_KEY);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, StoreModule.forRoot({})],
      providers: [
        DataService,
        InstanceUtilities,
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        { provide: CommitResultDialogService, useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog']) },
        { provide: MatchedInstancesDialogService, useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog']) },
      ]
    });
    service = TestBed.inject(DataService);
    utils = TestBed.inject(InstanceUtilities);
  });
  afterEach(() => localStorage.removeItem(NEXT_NEW_DB_ID_STORAGE_KEY));

  it('claimNewDbIds hands out a block from the shared counter, and the counter carries on below it', async () => {
    localStorage.setItem(NEXT_NEW_DB_ID_STORAGE_KEY, '-13');
    expect(await service.claimNewDbIds(3)).toEqual([-13, -14, -15]);
    expect(localStorage.getItem(NEXT_NEW_DB_ID_STORAGE_KEY)).toBe('-16');
    expect(await service.getNextNewDbId()).toBe(-16);
    expect(await service.claimNewDbIds(0)).toEqual([]);
  });

  it('a new instance never inherits the cached shell of an earlier instance that had its dbId', async () => {
    localStorage.setItem(NEXT_NEW_DB_ID_STORAGE_KEY, '-5');
    const stale = utils.getShellInstance({ dbId: -5, displayName: 'LANA1', schemaClassName: 'EntityWithAccessionedSequence' });
    spyOn(service, 'fetchSchemaClass').and.returnValue(of({ name: 'LiteratureReference' } as any));
    const created = await firstValueFrom(service.createNewInstance('LiteratureReference'));
    expect(created.dbId).toBe(-5);
    const shell = utils.getShellInstance(created);
    expect(shell).not.toBe(stale);
    expect(shell.schemaClassName).toBe('LiteratureReference');
  });
});
