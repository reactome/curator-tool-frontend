import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { Instance, NEW_DISPLAY_NAME } from '../models/reactome-instance.model';
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
});
