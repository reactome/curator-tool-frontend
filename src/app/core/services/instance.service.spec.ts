import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
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
