import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { Instance, NEW_DISPLAY_NAME } from '../models/reactome-instance.model';
import { AttributeCategory, AttributeDefiningType, AttributeDataType, SchemaAttribute, SchemaClass } from '../models/reactome-schema.model';
import { DataService } from './data.service';
import { InstanceUtilities } from './instance.service';

describe('InstanceUtilities.buildCommitSummaryResults', () => {
  let utils: InstanceUtilities;

  function makeInstance(dbId: number, displayName: string, schemaClassName = 'Pathway'): Instance {
    return { dbId, displayName, schemaClassName, attributes: new Map<string, any>() };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstanceUtilities,
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch']) },
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
    utils = TestBed.inject(InstanceUtilities);
  });

  // The reported bug: a new Reaction added to a new Pathway via hasEvent is committed together
  // with the Pathway, but the only shell kept for the Reaction still carries the placeholder it
  // was created with, so the summary showed "To be generated" for it.
  it('names a new instance committed along with its referrer from the payload snapshot', () => {
    const reaction = makeInstance(-2, 'A -> B', 'Reaction');
    const staleShell = makeInstance(-2, NEW_DISPLAY_NAME, 'Reaction'); // Referred from hasEvent
    utils.getShellInstance(staleShell);
    // DataService.commit snapshots the full instances that go into the payload...
    utils.rememberPreCommitDisplayNames([makeInstance(-1, 'My pathway'), reaction]);
    utils.setCommittedNewInstDbId(-2, 200); // ...and processCommit then re-keys the shell

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst = { ...makeInstance(100, 'My pathway'), newInstOld2NewId: { '-2': 200 } as any };

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: 'A -> B' });
  });

  // The server may report a co-committed instance by its persisted dbId only.
  it('names a co-committed instance reported without its local dbId', () => {
    utils.rememberPreCommitDisplayNames([makeInstance(-2, 'A -> B', 'Reaction')]);
    utils.setCommittedNewInstDbId(-2, 200);

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst: any = makeInstance(100, 'My pathway');
    rtnInst.committedInstances = [{ dbId: 200, displayName: NEW_DISPLAY_NAME }];

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: 'A -> B' });
  });

  it('keeps the generated name of a new instance committed along with its referrer', () => {
    const reaction = makeInstance(-2, 'A -> B', 'Reaction');
    utils.getShellInstance(reaction); // Referred from the Pathway's hasEvent
    utils.registerDisplayNameChange(reaction);
    utils.setCommittedNewInstDbId(-2, 200); // Done by processCommit before the summary is built

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst = { ...makeInstance(100, 'My pathway'), newInstOld2NewId: { '-2': 200 } as any };

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: 'A -> B' });
  });

  it('falls back to the display name cache when the new instance has no shell', () => {
    const reaction = makeInstance(-2, 'A -> B', 'Reaction');
    utils.registerDisplayNameChange(reaction);

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst = { ...makeInstance(100, 'My pathway'), newInstOld2NewId: { '-2': 200 } as any };

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: 'A -> B' });
  });

  it('prefers a tracked name over the placeholder returned for a committed instance', () => {
    const reaction = makeInstance(-2, 'A -> B', 'Reaction');
    utils.registerDisplayNameChange(reaction);
    utils.setCommittedNewInstDbId(-2, 200);

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst: any = makeInstance(100, 'My pathway');
    rtnInst.committedInstances = [{ dbId: 200, displayName: NEW_DISPLAY_NAME, newInstOldId: -2 }];

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: 'A -> B' });
  });

  it('uses the placeholder when no name is known anywhere', () => {
    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst = { ...makeInstance(100, 'My pathway'), newInstOld2NewId: { '-2': 200 } as any };

    const results = utils.buildCommitSummaryResults(pathway, rtnInst);

    expect(results).toContain({ dbId: 200, displayName: NEW_DISPLAY_NAME });
  });
});

describe('InstanceUtilities.processCommit', () => {
  let utils: InstanceUtilities;
  let store: jasmine.SpyObj<Store>;
  let dataService: jasmine.SpyObj<DataService>;

  function makeInstance(dbId: number, displayName: string, schemaClassName = 'Pathway'): Instance {
    return { dbId, displayName, schemaClassName, attributes: new Map<string, any>() };
  }

  /** The dbIds the store was asked to drop from the new instance list. */
  function removedNewDbIds(): number[] {
    return store.dispatch.calls.allArgs()
      .map(args => args[0] as any)
      .filter(action => action.type === NewInstanceActions.remove_new_instance.type)
      .map(action => action.dbId);
  }

  /** The old -> new dbId pairs the store was told about. */
  function committedNewDbIds(): [number, number][] {
    return store.dispatch.calls.allArgs()
      .map(args => args[0] as any)
      .filter(action => action.type === NewInstanceActions.commit_new_instance.type)
      .map(action => [action.oldDbId, action.newDbId]);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstanceUtilities,
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch']) },
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
    utils = TestBed.inject(InstanceUtilities);
    store = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    dataService = jasmine.createSpyObj<DataService>('DataService',
      ['flagSchemaTreeForReload', 'fetchInstance', 'getCachedInstance']);
  });

  // The reported bug: the new Persons created for the author attribute of a new LiteratureReference
  // are committed together with it, but they were left in the new instance list with their local
  // (negative) dbIds and could be committed a second time.
  it('removes a co-committed new instance that has no shell from the new instance list', () => {
    const author = makeInstance(-2, 'Doe D', 'Person');
    dataService.getCachedInstance.and.callFake(dbId => dbId === author.dbId ? author : undefined);

    const reference = makeInstance(-1, 'Doe D et al', 'LiteratureReference');
    const rtnInst = { ...makeInstance(100, 'Doe D et al', 'LiteratureReference'), newInstOld2NewId: { '-2': 200 } as any };

    utils.processCommit(reference, rtnInst, dataService);

    expect(removedNewDbIds()).toEqual([-1, -2]);
    expect(committedNewDbIds()).toEqual([[-1, 100], [-2, 200]]);
  });

  it('removes a co-committed new instance reported via committedInstances', () => {
    dataService.getCachedInstance.and.returnValue(undefined);

    const reference = makeInstance(-1, 'Doe D et al', 'LiteratureReference');
    const rtnInst: any = makeInstance(100, 'Doe D et al', 'LiteratureReference');
    rtnInst.committedInstances = [{ dbId: 200, displayName: 'Doe D', newInstOldId: -2 }];

    utils.processCommit(reference, rtnInst, dataService);

    expect(removedNewDbIds()).toEqual([-1, -2]);
    expect(committedNewDbIds()).toEqual([[-1, 100], [-2, 200]]);
  });

  it('does not handle the committed instance itself twice', () => {
    dataService.getCachedInstance.and.returnValue(undefined);

    const reference = makeInstance(-1, 'Doe D et al', 'LiteratureReference');
    // The server may include the committed instance in the mapping as well.
    const rtnInst = {
      ...makeInstance(100, 'Doe D et al', 'LiteratureReference'),
      newInstOld2NewId: { '-1': 100, '-2': 200 } as any
    };

    utils.processCommit(reference, rtnInst, dataService);

    expect(removedNewDbIds()).toEqual([-1, -2]);
    expect(committedNewDbIds()).toEqual([[-1, 100], [-2, 200]]);
  });

  it('still re-keys the shell of a co-committed new instance', () => {
    const reaction = makeInstance(-2, 'A -> B', 'Reaction');
    const shell = utils.getShellInstance(reaction); // Referred from the Pathway's hasEvent
    dataService.getCachedInstance.and.returnValue(undefined);

    const pathway = makeInstance(-1, 'My pathway');
    const rtnInst = { ...makeInstance(100, 'My pathway'), newInstOld2NewId: { '-2': 200 } as any };

    utils.processCommit(pathway, rtnInst, dataService);

    // The commit_new_instance effect normally does this via setCommittedNewInstDbId; with a mocked
    // store processCommit's own fallback is what re-keys the shell.
    expect(shell.dbId).toEqual(200);
    expect(utils.getShellInstance(makeInstance(200, 'A -> B', 'Reaction'))).toBe(shell);
  });

  // The reported danger: changeSchemaClass() mutates the canonical instance in place, but any
  // OTHER cached shell for the same dbId - e.g. the one an InteractionEvent's "interactor" list
  // holds via getShellInstance() - is a separate object and would otherwise keep the old class
  // (and old displayName) forever, since nothing else refreshes it once the commit succeeds.
  it('refreshes a stale shell after committing an instance whose class was switched', () => {
    const partner = makeInstance(500, 'AKT1:PIP3 complex', 'Complex');
    // A referrer (e.g. an InteractionEvent's "interactor" attribute) holds this exact shell.
    const staleShellHeldByReferrer = utils.getShellInstance(partner);
    dataService.getCachedInstance.and.returnValue(undefined);

    // applySchemaClassChange() flags the switch this way before commit.
    partner.schemaClassName = 'EntityWithAccessionedSequence';
    partner.modifiedAttributes = ['schemaClass'];

    const rtnInst = makeInstance(500, 'AKT1', 'EntityWithAccessionedSequence'); // Server's confirmed copy.

    utils.processCommit(partner, rtnInst, dataService);

    expect(staleShellHeldByReferrer.schemaClassName).toBe('EntityWithAccessionedSequence');
    expect(staleShellHeldByReferrer.displayName).toBe('AKT1');
  });

  it('leaves a shell alone when the commit did not change the class', () => {
    const reaction = makeInstance(200, 'A -> B', 'Reaction');
    const shell = utils.getShellInstance(reaction);
    dataService.getCachedInstance.and.returnValue(undefined);

    // An ordinary attribute edit: no 'schemaClass' in modifiedAttributes.
    const committedInst = { ...makeInstance(200, 'A -> B', 'Reaction'), modifiedAttributes: ['name'] };
    const rtnInst = makeInstance(200, 'A -> B', 'Reaction');

    utils.processCommit(committedInst, rtnInst, dataService);

    expect(shell.schemaClassName).toBe('Reaction');
  });
});

describe('InstanceUtilities commit danger: a referenced partner switched to a disallowed class', () => {
  let utils: InstanceUtilities;

  const complexSchema: SchemaClass = {
    name: 'Complex',
    attributes: [
      {
        name: 'hasComponent', cardinality: '+', origin: 'Complex',
        category: AttributeCategory.MANDATORY, definingType: AttributeDefiningType.ALL_DEFINING, type: AttributeDataType.INSTANCE,
      },
    ],
  };

  const ewasSchema: SchemaClass = {
    name: 'EntityWithAccessionedSequence',
    attributes: [
      {
        name: 'referenceEntity', cardinality: '1', origin: 'EntityWithAccessionedSequence',
        category: AttributeCategory.MANDATORY, definingType: AttributeDefiningType.NONE_DEFINING, type: AttributeDataType.INSTANCE,
      },
    ],
  };

  // The InteractionEvent's own "interactor" slot only ever allows a Complex (or a descendant of it),
  // never a bare EntityWithAccessionedSequence (EWAS) -- a lone protein must be wrapped in a
  // (possibly single-component) Complex before it can fill this slot.
  const interactorAttribute: SchemaAttribute = {
    name: 'interactor', cardinality: '+', origin: 'InteractionEvent',
    category: AttributeCategory.MANDATORY, definingType: AttributeDefiningType.NONE_DEFINING, type: AttributeDataType.INSTANCE,
    allowedClases: ['Complex'],
  };

  // Fake enough of DataService for isClassAllowedForAttribute, which only needs getSchemaClass().
  const fakeDataService = {
    getSchemaClass: (name: string) => [complexSchema, ewasSchema].find(cls => cls.name === name),
  } as DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstanceUtilities,
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch']) },
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
    utils = TestBed.inject(InstanceUtilities);
  });

  // Reproduces the reported danger: an InteractionEvent's "interactor" partner is a Complex, but
  // that exact same cached object later has its class switched to EntityWithAccessionedSequence
  // (e.g. a curator "unwraps" a single-component Complex by reclassifying the wrapper itself via
  // the change-class dialog, instead of replacing the reference with its inner EWAS component).
  // changeSchemaClass mutates the instance IN PLACE rather than replacing it, so every referrer
  // still holding that reference -- including the InteractionEvent below -- transitively "sees"
  // an EWAS where it expects a Complex, with the Complex-only attributes (hasComponent) already
  // dropped because EWAS's schema doesn't define them.
  //
  // isClassAllowedForAttribute exists to catch exactly this (EntityWithAccessionedSequence is not
  // in interactorAttribute.allowedClases = ['Complex']), but it is only ever invoked from the
  // change-class dialog's own warning UI -- never from the commit/serialize path. So
  // cloneInstanceForCommit (used by DataService.commit) has no guard here: it silently serializes
  // the corrupted, attribute-wiped partner into the commit payload as if nothing were wrong.
  it('silently commits a partner whose class was switched away from what its attribute allows', () => {
    const complexPartner: Instance = {
      dbId: 500,
      displayName: 'AKT1:PIP3 complex',
      schemaClassName: 'Complex',
      schemaClass: complexSchema,
      attributes: new Map<string, any>([
        ['hasComponent', [{ dbId: 501, displayName: 'AKT1', schemaClassName: 'EntityWithAccessionedSequence', attributes: new Map() }]],
      ]),
    };

    const interactionEvent: Instance = {
      dbId: 900,
      displayName: 'AKT1 interacts with PIP3',
      schemaClassName: 'InteractionEvent',
      attributes: new Map<string, any>([
        ['interactor', [complexPartner]], // Same object reference held by the InteractionEvent.
      ]),
    };

    // Sanity check: before the switch, the partner is a legitimate Complex for this slot.
    expect(utils.isClassAllowedForAttribute(complexPartner.schemaClassName, interactorAttribute, fakeDataService)).toBeTrue();

    // "Somehow switched to another class": mutates complexPartner in place.
    utils.changeSchemaClass(complexPartner, ewasSchema);

    expect(complexPartner.schemaClassName).toBe('EntityWithAccessionedSequence');
    expect(complexPartner.attributes.has('hasComponent')).toBeFalse(); // Wiped: not part of EWAS's schema.
    expect(utils.isClassAllowedForAttribute(complexPartner.schemaClassName, interactorAttribute, fakeDataService)).toBeFalse();

    // Commit-time serialization never checks isClassAllowedForAttribute, so the switch goes
    // through unnoticed: the payload's "interactor" now silently carries an attribute-wiped EWAS
    // rather than being rejected or flagged. Worse, since hasComponent was the partner's only
    // attribute, the wipe leaves its attributes Map empty, and cloneInstanceForCommitInternal only
    // sets `attributes` on the clone when `source.attributes.size > 0` -- so the clone drops the
    // `attributes` field entirely, rather than serializing an empty object.
    const committed = utils.cloneInstanceForCommit(interactionEvent);
    const interactorClone = committed.attributes['interactor'][0];

    expect(interactorClone.schemaClassName).toBe('EntityWithAccessionedSequence');
    expect(interactorClone.attributes).toBeUndefined();
  });
});

/**
 * Anything placed into the event tree has to carry its attributes as a plain object, because the
 * tree is built straight from the JSON `fetchEventTree` returns and MatTreeFlattener indexes that
 * object. An instance from DataService's cache carries a Map instead, and on a Map every one of
 * those reads comes back undefined - the event would render as a childless leaf with no release
 * flag, hidden by any species filter. toEventTreeInstance is the conversion.
 */
describe('InstanceUtilities.toEventTreeInstance', () => {
  let utils: InstanceUtilities;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstanceUtilities,
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch']) },
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
    utils = TestBed.inject(InstanceUtilities);
  });

  const child: Instance = { dbId: 200, displayName: 'A child reaction', schemaClassName: 'Reaction' };

  function cachedPathway(): Instance {
    return {
      dbId: 100,
      displayName: 'A pathway outside the tree',
      schemaClassName: 'Pathway',
      attributes: new Map<string, any>([
        ['hasEvent', [child]],
        ['hasDiagram', true],
        ['doRelease', true],
        ['speciesName', 'Homo sapiens'],
        ['summation', [{ dbId: 300, displayName: 'A summation', schemaClassName: 'Summation' }]],
      ]),
    };
  }

  it('turns a cached instance into one the tree can read', () => {
    const treeInstance = utils.toEventTreeInstance(cachedPathway());

    expect(treeInstance.attributes instanceof Map).toBeFalse();
    // The four attributes the tree itself displays, read the way the tree reads them.
    expect(treeInstance.attributes['hasEvent'].length).toBe(1);
    expect(treeInstance.attributes['hasEvent'][0]).toBe(child); // Same event, for identity lookups
    expect(treeInstance.attributes['hasDiagram']).toBeTrue();
    expect(treeInstance.attributes['doRelease']).toBeTrue();
    expect(treeInstance.attributes['speciesName']).toBe('Homo sapiens');
    expect(treeInstance.dbId).toBe(100);
    expect(treeInstance.displayName).toBe('A pathway outside the tree');
    expect(treeInstance.schemaClassName).toBe('Pathway');
  });

  it('carries nothing the tree does not display', () => {
    // The full instance stays in the cache; the tree only ever looks up these four.
    const treeInstance = utils.toEventTreeInstance(cachedPathway());

    expect(Object.keys(treeInstance.attributes).sort())
      .toEqual(['doRelease', 'hasDiagram', 'hasEvent', 'speciesName']);
  });

  it('does not let the tree splice the cached instance own hasEvent list', () => {
    // The tree removes an event from its parent's hasEvent by splicing that array in place
    // (EventTreeComponent.handleInstanceDeletion). Sharing the array would turn marking an event
    // for deletion into an unregistered edit of the staged instance.
    const cached = cachedPathway();
    const treeInstance = utils.toEventTreeInstance(cached);

    treeInstance.attributes['hasEvent'].splice(0, 1);

    expect(treeInstance.attributes['hasEvent'].length).toBe(0);
    expect(cached.attributes.get('hasEvent').length).toBe(1);
  });

  it('leaves out an attribute the instance does not have', () => {
    const shell: Instance = { dbId: -1, displayName: 'A new pathway', schemaClassName: 'Pathway' };

    const treeInstance = utils.toEventTreeInstance(shell);

    expect(treeInstance.attributes).toEqual({});
    // What the tree reads off a childless node, without throwing on the missing attributes.
    expect(treeInstance.attributes['hasEvent']).toBeUndefined();
  });

  it('is a no-op in shape for an instance already in the tree', () => {
    const treeShaped: Instance = {
      dbId: 100,
      displayName: 'A pathway in the tree',
      schemaClassName: 'Pathway',
      attributes: { hasEvent: [child], doRelease: false },
    };

    const treeInstance = utils.toEventTreeInstance(treeShaped);

    expect(treeInstance.attributes['hasEvent'][0]).toBe(child);
    expect(treeInstance.attributes['doRelease']).toBeFalse();
  });
});

/**
 * Reporting a circular hasEvent that this session's uncommitted edits created.
 *
 * Editing hasEvent is no longer refused - establishing what already contains an event cost a
 * request per ancestor on every edit (see EventCycleCheck) - so a curator can create a cycle from
 * the schema view and is told about it when the event view next builds the hierarchy. A cycle
 * already in the database is reported by the backend's getEventTree; this covers the other half,
 * the edits that have not been committed yet and that only this front end knows about.
 *
 * Dropping the relationship matters as much as reporting it: the event tree is flattened in full
 * when it is rendered (MatTreeFlattener walks every node, not just the expanded ones), so a cycle
 * left in the data would hang the event view rather than show the curator anything.
 */
describe('InstanceUtilities.mergeLocalChangesToEventTree circular hasEvent', () => {
  let utils: InstanceUtilities;

  beforeEach(() => {
    const store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']);
    // Nothing marked for deletion. An NgRx store emits its current state on subscribe, which is
    // what lets the merge report synchronously.
    store.select.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        InstanceUtilities,
        { provide: Store, useValue: store },
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
    utils = TestBed.inject(InstanceUtilities);
  });

  /** A node of the event tree: attributes are a plain object here, not a Map. */
  function treeEvent(dbId: number, displayName: string, children: Instance[] = []): Instance {
    return { dbId, displayName, schemaClassName: 'Pathway', attributes: { hasEvent: children } as any };
  }

  /** A cached instance carrying an uncommitted hasEvent edit: attributes are a Map. */
  function editedEvent(dbId: number, displayName: string, hasEvent: { dbId: number }[]): Instance {
    return {
      dbId, displayName, schemaClassName: 'Pathway',
      modifiedAttributes: ['hasEvent'],
      attributes: new Map<string, any>([['hasEvent', hasEvent]]),
    };
  }

  /** The reported cycle as the event view renders it. */
  function pathOf(cycle: { path: { dbId: number, displayName: string }[] }): string {
    return cycle.path.map(event => `${event.displayName} [${event.dbId}]`).join(' > ');
  }

  function childDbIds(event: Instance): number[] {
    return (event.attributes['hasEvent'] as Instance[]).map(child => child.dbId);
  }

  it('drops and reports an event given a pathway that already contains it', () => {
    // Metabolism [10] > Glycolysis [20], and the curator has just added Metabolism to Glycolysis'
    // hasEvent from the schema view.
    const glycolysis = treeEvent(20, 'Glycolysis');
    const metabolism = treeEvent(10, 'Metabolism', [glycolysis]);
    const root = treeEvent(0, 'TopLevelPathway', [metabolism]);
    const id2instance = new Map<number, Instance>([[20, editedEvent(20, 'Glycolysis', [{ dbId: 10 }])]]);

    const cycles = utils.mergeLocalChangesToEventTree(root, id2instance);

    expect(cycles.length).toBe(1);
    expect(pathOf(cycles[0])).toBe('Metabolism [10] > Glycolysis [20]');
    expect(cycles[0].local).withContext('an uncommitted edit, not the database').toBeTrue();
    // The tree is otherwise intact, so the curator can navigate to Glycolysis and remove it.
    expect(childDbIds(root)).toEqual([10]);
    expect(childDbIds(metabolism)).toEqual([20]);
    expect(childDbIds(glycolysis)).withContext('the cycle must not be left in the data').toEqual([]);
  });

  it('drops and reports an event added to its own hasEvent', () => {
    const metabolism = treeEvent(10, 'Metabolism');
    const root = treeEvent(0, 'TopLevelPathway', [metabolism]);
    const id2instance = new Map<number, Instance>([[10, editedEvent(10, 'Metabolism', [{ dbId: 10 }])]]);

    const cycles = utils.mergeLocalChangesToEventTree(root, id2instance);

    expect(cycles.length).toBe(1);
    expect(pathOf(cycles[0])).toBe('Metabolism [10]');
    expect(childDbIds(metabolism)).toEqual([]);
  });

  it('reports the cycle without the branch that led down to it', () => {
    // The walk reaches the cycle through Disease [1], but Disease is not part of it and naming it
    // would only make the message harder to act on.
    const mapk = treeEvent(20, 'MAPK cascade');
    const signaling = treeEvent(10, 'Signaling', [mapk]);
    const root = treeEvent(1, 'Disease', [signaling]);
    const id2instance = new Map<number, Instance>([[20, editedEvent(20, 'MAPK cascade', [{ dbId: 10 }])]]);

    const cycles = utils.mergeLocalChangesToEventTree(root, id2instance);

    expect(cycles.length).toBe(1);
    expect(pathOf(cycles[0])).toBe('Signaling [10] > MAPK cascade [20]');
  });

  it('reports one cycle per relationship however many routes reach it', () => {
    // Signaling sits under two branches, so the merge visits the cyclic relationship twice. It is
    // one thing for the curator to fix.
    const signalingA = treeEvent(30, 'Signaling', [treeEvent(40, 'MAPK cascade')]);
    const signalingB = treeEvent(30, 'Signaling', [treeEvent(40, 'MAPK cascade')]);
    const root = treeEvent(1, 'TopLevelPathway', [
      treeEvent(10, 'Branch A', [signalingA]),
      treeEvent(20, 'Branch B', [signalingB]),
    ]);
    const id2instance = new Map<number, Instance>([[40, editedEvent(40, 'MAPK cascade', [{ dbId: 30 }])]]);

    const cycles = utils.mergeLocalChangesToEventTree(root, id2instance);

    expect(cycles.length).toBe(1);
    expect(pathOf(cycles[0])).toBe('Signaling [30] > MAPK cascade [40]');
    // Both occurrences have to be repaired, not just the one the cycle was reported from:
    // each is a separate object with its own hasEvent array.
    expect(childDbIds(signalingA)).toEqual([40]);
    expect(childDbIds(signalingB)).toEqual([40]);
    expect(childDbIds((signalingA.attributes['hasEvent'] as Instance[])[0])).toEqual([]);
    expect(childDbIds((signalingB.attributes['hasEvent'] as Instance[])[0])).toEqual([]);
  });

  it('reports nothing for an event that legitimately sits under several parents', () => {
    // Cell Cycle Checkpoints is listed in two branches. A DAG is not a cycle, and both occurrences
    // must still be merged - which is why the path is tracked rather than every event seen.
    const checkpointsA = treeEvent(30, 'Cell Cycle Checkpoints', [treeEvent(40, 'G2/M Checkpoints')]);
    const checkpointsB = treeEvent(30, 'Cell Cycle Checkpoints', [treeEvent(40, 'G2/M Checkpoints')]);
    const root = treeEvent(1, 'TopLevelPathway', [
      treeEvent(10, 'Mitotic Cell Cycle', [checkpointsA]),
      treeEvent(20, 'Meiotic Cell Cycle', [checkpointsB]),
    ]);
    const id2instance = new Map<number, Instance>([
      [30, { dbId: 30, displayName: 'Checkpoints renamed', schemaClassName: 'Pathway',
             modifiedAttributes: ['name'], attributes: new Map<string, any>() }],
    ]);

    const cycles = utils.mergeLocalChangesToEventTree(root, id2instance);

    expect(cycles).toEqual([]);
    expect(childDbIds(checkpointsA)).toEqual([40]);
    expect(childDbIds(checkpointsB)).toEqual([40]);
    // The rename still reached both occurrences.
    expect(checkpointsA.displayName).toBe('Checkpoints renamed');
    expect(checkpointsB.displayName).toBe('Checkpoints renamed');
  });

  it('reports nothing for a sound hierarchy with no local edits', () => {
    const root = treeEvent(0, 'TopLevelPathway', [treeEvent(10, 'Metabolism', [treeEvent(20, 'Glycolysis')])]);

    expect(utils.mergeLocalChangesToEventTree(root, new Map<number, Instance>())).toEqual([]);
  });
});
