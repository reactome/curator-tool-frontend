import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { Instance, NEW_DISPLAY_NAME } from '../models/reactome-instance.model';
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
