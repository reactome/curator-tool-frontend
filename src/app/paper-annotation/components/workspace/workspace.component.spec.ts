import { Location } from '@angular/common';
import { fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { ExistingMatch, Issue, PaperInfo, Proposal, SessionDetail } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { CHECKED_REACTIONS_KEY, LOADED_DB_IDS_KEY, LOADED_SESSION_KEY } from '../../services/staging';
import { ReferencePreparer } from '../../services/reference-preparer.service';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent', () => {
  const session = (status: SessionDetail['status']): SessionDetail => ({
    id: 's1', pmid: '24751536', source: '24751536', status, progress: status, created: 1, updated: 2,
    n_reactions: 2, n_open_issues: 2, focus: 'PINK1', error: status === 'failed' ? 'no full text' : null,
    reactions: [{ key: 'r0', name: 'PINK1 phosphorylates Ub', dbId: -5, evidenceIds: [] }, { key: 'r1', name: 'Parkin binds pUb', dbId: -9, evidenceIds: [] }]
  });
  const issue = (id: string, key: string | null, severity: Issue['severity'], status: Issue['status'] = 'open'): Issue =>
    ({ id, source: 'qa', severity, code: 'c', message: 'm', reaction_key: key, participant_key: null, instance_db_id: null, status });
  const match = (key: string, level: ExistingMatch['level']): ExistingMatch =>
    ({ reaction_key: key, db_id: 1, display_name: 'x', st_id: 'R-HSA-1', level, score: 1, cites_pmid: false, catalyst_match: true, overlap: 1, similarity: 1, reasons: [] });

  const suggestion = (id: string, key: string): Proposal =>
    ({ id, reason: 'why', ops: [], summary: ['changes'], reaction_keys: [key], evidence: [], actor: 'suggestions', status: 'pending', created: 1, decided_by: null, decided_at: null });

  let api: jasmine.SpyObj<any>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let snack: jasmine.SpyObj<MatSnackBar>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;
  let location: jasmine.SpyObj<Location>;
  let openSpy: jasmine.Spy;
  let snackAction: Subject<void>;
  let component: WorkspaceComponent;
  let references: jasmine.SpyObj<ReferencePreparer>;
  const noReferences = { filled: [], unfilled: [], pdfs: [] };
  // r0 (-5) with its summation, r1 (-9), and the annotation's pathway holding both
  const ref = (dbId: number, schemaClassName: string) => ({ dbId, displayName: 'x', schemaClassName });
  const exported = {
    newInstances: [
      { dbId: -5, schemaClassName: 'Reaction', attributes: { summation: [ref(-2, 'Summation')] } },
      { dbId: -2, schemaClassName: 'Summation' },
      { dbId: -9, schemaClassName: 'Reaction' },
      { dbId: -1, schemaClassName: 'Pathway', attributes: { hasEvent: [ref(-5, 'Reaction'), ref(-9, 'Reaction')] } },
    ], updatedInstances: [], deletedInstances: [], bookmarks: [] };
  const loadedIds = () => (userInstances.loadAnnotationInstances.calls.mostRecent().args[0].newInstances as any[]).map(i => i.dbId);

  const make = () => {
    api = jasmine.createSpyObj('LlmApiService', ['session', 'issues', 'existing', 'exportInstances', 'proposals']);
    api.session.and.returnValue(of(session('ready')));
    api.issues.and.returnValue(of([issue('i1', 'r0', 'action'), issue('i2', 'r0', 'warning'), issue('i3', 'r1', 'info', 'dismissed')]));
    api.existing.and.returnValue(of([match('r1', 'same'), match('r0', 'similar')]));
    api.proposals.and.returnValue(of([suggestion('p-001', 'r0'), { ...suggestion('p-002', 'r1'), actor: 'chat' }]));
    api.exportInstances.and.returnValue(of(exported));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    snack = jasmine.createSpyObj('MatSnackBar', ['open']);
    snackAction = new Subject<void>();
    snack.open.and.returnValue({ onAction: () => snackAction } as any);
    userInstances = jasmine.createSpyObj('UserInstancesService', ['stagedSummary', 'loadAnnotationInstances']);
    userInstances.stagedSummary.and.returnValue(of({ replaced: 4, keepsDefaultPerson: false, keepsBookmarks: 0 }));
    userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 4, backedUp: true, backupFile: 'b.json', loaded: 2, keptDefaultPerson: false, keptBookmarks: 0, stagedToExported: new Map<number, number>() }));
    location = jasmine.createSpyObj('Location', ['prepareExternalUrl']);
    location.prepareExternalUrl.and.callFake((path: string) => `/curatortool${path}`);
    openSpy = spyOn(window, 'open');
    const route = { paramMap: of(convertToParamMap({ id: 's1' })) } as unknown as ActivatedRoute;
    references = jasmine.createSpyObj('ReferencePreparer', ['prepare']);
    references.prepare.and.callFake((e: any) => of({ exported: e, report: noReferences }));
    component = new WorkspaceComponent(api, route, location, dialog, snack, userInstances, references);
    localStorage.removeItem(LOADED_SESSION_KEY);
    localStorage.removeItem(LOADED_DB_IDS_KEY);
  };
  const answer = (confirmed: boolean) => dialog.open.and.returnValue({ afterClosed: () => of(confirmed) } as any);

  afterEach(() => {
    localStorage.removeItem(LOADED_SESSION_KEY);
    localStorage.removeItem(LOADED_DB_IDS_KEY);
    localStorage.removeItem(CHECKED_REACTIONS_KEY + 's1');
    localStorage.removeItem(WorkspaceComponent.DETAIL_WIDTH_KEY);
  });

  it('follows a running session until it is ready, then loads issues and matches and selects the first reaction', fakeAsync(() => {
    make();
    api.session.and.returnValues(of(session('running')), of(session('running')), of(session('ready')));
    component.ngOnInit();
    tick(0);
    expect(component.active).toBeTrue();
    expect(api.issues).not.toHaveBeenCalled();
    tick(3000); tick(3000);
    expect(component.session?.status).toBe('ready');
    expect(api.issues).toHaveBeenCalledTimes(1);
    expect(component.selectedKey).toBe('r0');
    tick(30000);
    expect(api.session).toHaveBeenCalledTimes(3);              // stopped polling once settled
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('titles an annotation by its paper, or by how many papers it merges, and lists them', () => {
    make();
    component.session = null;
    expect(component.title).toBe('');
    component.session = session('ready');
    expect(component.title).toBe('PMID 24751536');
    expect(component.papers).toEqual([]);                                   // an older service sends no paper list
    component.session = { ...session('ready'), pmid: null, source: 'paper.pdf' };
    expect(component.title).toBe('paper.pdf');
    const papers: PaperInfo[] = [{ source: 'PMID:24751536', kind: 'pmid', pmid: '24751536', name: '24751536' },
                                 { source: 'ab12_clock.pdf', kind: 'pdf', pmid: null, name: 'clock.pdf' },
                                 { source: 'PMID:29168502', kind: 'pmid', pmid: '29168502', name: '29168502' }];
    component.session = { ...session('ready'), n_papers: 3, source: '3 papers: 24751536, clock.pdf, 29168502', papers };
    expect(component.title).toBe('3 papers');
    expect(component.papers.map(component.paperLabel)).toEqual(['PMID 24751536', 'clock.pdf', 'PMID 29168502']);
  });

  it('stops at a failed session and shows nothing to review', fakeAsync(() => {
    make();
    api.session.and.returnValue(of(session('failed')));
    component.ngOnInit();
    tick(10000);
    expect(component.session?.error).toBe('no full text');
    expect(api.issues).not.toHaveBeenCalled();
    expect(api.session).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('reports an unreachable service instead of failing silently', fakeAsync(() => {
    make();
    api.session.and.returnValue(throwError(() => new LlmApiError(0, 'The annotation service is not reachable.')));
    component.ngOnInit();
    tick(0);
    expect(component.error).toContain('not reachable');
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('sorts the reactions as in the paper, by what needs attention, or by name, and marks the ones to keep or remove', fakeAsync(() => {
    make();
    const three = { ...session('ready'), n_reactions: 3, qa: { r0: { priority: 'review' as const, summary: null, score: 0.8, is_reaction: true },
                                                              r1: { priority: 'fix_first' as const, summary: null, score: 0.3, is_reaction: true } },
      reactions: [{ key: 'r0', name: 'PINK1 phosphorylates Ub', dbId: -5, evidenceIds: [] },
                  { key: 'r1', name: 'parkin binds pUb', dbId: -9, evidenceIds: [] },
                  { key: 'r2', name: 'Atg5 binds Atg12', dbId: -7, evidenceIds: [], equation: 'ATG5 + ATG12 -> ATG5:ATG12' }] };
    api.session.and.returnValue(of(three));
    api.issues.and.returnValue(of([
      { ...issue('k', 'r2', 'warning'), category: 'keep', message: 'every quote comes from Methods' },
      { ...issue('w', 'r2', 'action'), blocked_by: 'k' },                 // waits on the decision: not counted
      { ...issue('a', 'r0', 'action'), category: 'content' },
      { ...issue('n', 'r0', 'info'), category: 'existing' }]));           // a note: not counted
    component.ngOnInit();
    tick(0);
    const keys = () => component.sortedReactions.map(r => r.key);
    expect(keys()).toEqual(['r0', 'r1', 'r2']);                           // as in the paper
    component.reactionSort = 'attention';
    expect(keys()).toEqual(['r2', 'r1', 'r0']);                           // keep or remove?, then fix first, then review
    component.reactionSort = 'name';
    expect(keys()).toEqual(['r2', 'r1', 'r0']);                           // Atg5, parkin, PINK1: case does not matter
    expect(component.needsDecision('r2')).toBeTrue();
    expect(component.needsDecision('r0')).toBeFalse();
    expect(component.decisionReason('r2')).toBe('every quote comes from Methods');
    expect(component.openCount('r2')).toBe(0);
    expect(component.openCount('r0')).toBe(1);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('after a reaction is removed, selects its neighbour, forgets it in the checked set and marks staging stale', fakeAsync(() => {
    make();
    api.removeReaction = jasmine.createSpy('removeReaction');
    const three = { ...session('ready'), n_reactions: 3,
      reactions: [{ key: 'r0', name: 'a', dbId: -5, evidenceIds: [] }, { key: 'r1', name: 'b', dbId: -9, evidenceIds: [] },
                  { key: 'r2', name: 'c', dbId: -7, evidenceIds: [] }] };
    api.session.and.returnValue(of(three));
    component.ngOnInit();
    tick(0);
    component.select('r1');
    component.setChecked('r1', true);
    component.setChecked('r2', true);
    const stamp = component.draftStamp;
    api.session.and.returnValue(of({ ...three, n_reactions: 2, reactions: [three.reactions[0], three.reactions[2]] }));
    component.onReactionRemoved('r1');
    tick(0);
    expect(component.selectedKey).toBe('r2');
    expect([...component.checkedKeys]).toEqual(['r2']);
    expect(component.stagingStale).toBeTrue();
    expect(component.draftStamp).toBe(stamp + 1);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('follows a reaction removed elsewhere (Issues tab, accepted edit): the selection moves to the first one', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    component.select('r1');
    api.session.and.returnValue(of({ ...session('ready'), n_reactions: 1, reactions: [session('ready').reactions[0]] }));
    component.reload();
    tick(0);
    expect(component.selectedKey).toBe('r0');
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('summarises issues and matches per reaction', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    expect(component.openIssues.length).toBe(2);
    expect(component.openCount('r0')).toBe(2);
    expect(component.openCount('r1')).toBe(0);                 // the dismissed one does not count
    expect(component.worstSeverity('r0')).toBe('action');
    expect(component.worstSeverity('r1')).toBe('');
    expect(component.hasSameMatch('r1')).toBeTrue();
    expect(component.hasSameMatch('r0')).toBeFalse();          // only "similar"
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('offers the selected reaction to the chat by the id the instances were exported with', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    expect(component.contextDbIds).toEqual([-5]);
    component.select('r1');
    expect(component.contextDbIds).toEqual([-9]);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('updates an issue in place and the open count', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    component.onIssueChanged(issue('i1', 'r0', 'action', 'resolved'));
    expect(component.openIssues.length).toBe(1);
    expect(component.session?.n_open_issues).toBe(1);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  describe('loading into staged instances', () => {
    beforeEach(fakeAsync(() => {
      make(); component.ngOnInit(); tick(0); component.ngOnDestroy(); discardPeriodicTasks();
      component.setChecked('r0', true);
    }));

    it('asks with the real counts, then loads only the checked reaction, remembers the session and tells the curator about the backup', () => {
      answer(true);
      component.stagingStale = true;
      component.loadIntoStaging();
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual(
        { staged: 4, keepsDefaultPerson: false, keepsBookmarks: 0, incoming: 2, stale: true, reactions: 1, totalReactions: 2, pathway: false,
          references: noReferences });
      // judged against what is about to be loaded: r0 and its summation, not r1 nor the pathway
      expect((userInstances.stagedSummary.calls.mostRecent().args[0].newInstances as any[]).map(i => i.dbId)).toEqual([-5, -2]);
      expect(loadedIds()).toEqual([-5, -2]);
      expect(localStorage.getItem(LOADED_SESSION_KEY)).toBe('s1');
      expect(component.stagingStale).toBeFalse();
      expect(component.loading).toBeFalse();
      expect(snack.open.calls.mostRecent().args[0]).toContain('Loaded 1 reaction (2 instances)');
      expect(snack.open.calls.mostRecent().args[0]).toContain('b.json');
    });

    it('remembers which exported dbId each renumbered instance came from, for its evidence', () => {
      answer(true);
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 0, backedUp: false, loaded: 2, keptDefaultPerson: false,
        keptBookmarks: 0, stagedToExported: new Map([[-41, -5], [-42, -2]]) }));
      component.loadIntoStaging();
      expect(JSON.parse(localStorage.getItem(LOADED_DB_IDS_KEY)!)).toEqual({ '-41': -5, '-42': -2 });
    });

    it('tells the curator what was kept, in the dialog and afterwards', () => {
      answer(true);
      userInstances.stagedSummary.and.returnValue(of({ replaced: 4, keepsDefaultPerson: true, keepsBookmarks: 3 }));
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 4, backedUp: true, backupFile: 'b.json', loaded: 2, keptDefaultPerson: true, keptBookmarks: 3, stagedToExported: new Map<number, number>() }));
      component.loadIntoStaging();
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual(jasmine.objectContaining({ staged: 4, keepsDefaultPerson: true, keepsBookmarks: 3 }));
      expect(snack.open.calls.mostRecent().args[0]).toContain('Kept as they are: your default person and 3 bookmarks.');
    });

    it('words a single kept bookmark, and a kept default person alone', () => {
      answer(true);
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 0, backedUp: false, loaded: 2, keptDefaultPerson: false, keptBookmarks: 1, stagedToExported: new Map<number, number>() }));
      component.loadIntoStaging();
      expect(snack.open.calls.mostRecent().args[0]).toContain('Kept as they are: your 1 bookmark.');
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 0, backedUp: false, loaded: 2, keptDefaultPerson: true, keptBookmarks: 0, stagedToExported: new Map<number, number>() }));
      component.loadIntoStaging();
      expect(snack.open.calls.mostRecent().args[0]).toContain('Kept as they are: your default person.');
    });

    it('says nothing about kept items when there were none', () => {
      answer(true);
      component.loadIntoStaging();
      expect(snack.open.calls.mostRecent().args[0]).not.toContain('Kept as they are');
    });

    it('opens Schema View in a new tab when the curator asks, so the annotation stays open', () => {
      answer(true);
      component.loadIntoStaging();
      expect(snack.open.calls.mostRecent().args[1]).toBe('Open schema view');
      expect(openSpy).not.toHaveBeenCalled();                      // loading alone does not move anywhere
      snackAction.next();
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledWith('/curatortool/schema_view', '_blank', 'noopener');   // base path included
    });

    it('changes nothing when the curator cancels', () => {
      answer(false);
      component.loadIntoStaging();
      expect(userInstances.loadAnnotationInstances).not.toHaveBeenCalled();
      expect(localStorage.getItem(LOADED_SESSION_KEY)).toBeNull();
      expect(component.loading).toBeFalse();
    });

    it('shows the reason and remembers nothing when the backup fails', () => {
      answer(true);
      userInstances.loadAnnotationInstances.and.returnValue(throwError(() => new Error('server down')));
      component.stagingStale = true;
      component.loadIntoStaging();
      expect(component.error).toBe('server down');
      expect(localStorage.getItem(LOADED_SESSION_KEY)).toBeNull();
      expect(component.stagingStale).toBeTrue();               // still needs loading
      expect(component.loading).toBeFalse();
    });

    it('does not open the dialog when the export cannot be read', () => {
      api.exportInstances.and.returnValue(throwError(() => new LlmApiError(409, 'session is running; nothing to export yet')));
      component.loadIntoStaging();
      expect(dialog.open).not.toHaveBeenCalled();
      expect(component.error).toContain('nothing to export');
    });

    it('ignores a second click while one load is in progress', () => {
      dialog.open.and.returnValue({ afterClosed: () => of(undefined) } as any);
      component.loading = true;
      component.loadIntoStaging();
      expect(api.exportInstances).not.toHaveBeenCalled();
    });

    it('gets the cited papers ready for the checked reactions, and loads what that gave', () => {
      answer(true);
      const prepared = { ...exported, newInstances: [{ dbId: -5, schemaClassName: 'Reaction' }] };
      const report = { ...noReferences, pdfs: ['notes.pdf'] };
      references.prepare.and.returnValue(of({ exported: prepared as any, report }));
      component.loadIntoStaging();
      const [selected, sessionId, rs, papers] = references.prepare.calls.mostRecent().args;
      expect((selected.newInstances as any[]).map(i => i.dbId)).toEqual([-5, -2]);   // after cutting down to r0
      expect(sessionId).toBe('s1');
      expect(rs.map(r => r.key)).toEqual(['r0', 'r1']);
      expect(papers).toEqual([]);
      expect(loadedIds()).toEqual([-5]);
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual(jasmine.objectContaining({ references: report, incoming: 1 }));
      expect(snack.open.calls.mostRecent().args[0]).toContain('1 reference needs a PubMed ID');
      expect(component.loadStep).toBeNull();
    });

    it('does nothing when no reaction is checked', () => {
      component.setAllChecked(false);
      component.loadIntoStaging();
      expect(api.exportInstances).not.toHaveBeenCalled();
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('loads the pathway too when every reaction is checked', () => {
      answer(true);
      component.setAllChecked(true);
      component.loadIntoStaging();
      expect(loadedIds().sort((a, b) => a - b)).toEqual([-9, -5, -2, -1]);
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual(jasmine.objectContaining({ incoming: 4, reactions: 2, totalReactions: 2, pathway: true }));
    });

    it('leaves the pathway out when only some reactions are checked', () => {
      answer(true);
      component.loadIntoStaging();                                   // only r0 is checked
      expect(loadedIds()).not.toContain(-1);
    });
  });

  describe('checking reactions to load', () => {
    beforeEach(() => localStorage.removeItem(CHECKED_REACTIONS_KEY + 's1'));

    it('starts with nothing checked', fakeAsync(() => {
      make(); component.ngOnInit(); tick(0);
      expect(component.checkedCount).toBe(0);
      expect(component.isChecked('r0')).toBeFalse();
      expect(component.allChecked).toBeFalse();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('checks one, all and none, and counts only what is checked', fakeAsync(() => {
      make(); component.ngOnInit(); tick(0);
      component.setChecked('r1', true);
      expect(component.checkedCount).toBe(1);
      expect(component.isChecked('r1')).toBeTrue();
      component.setAllChecked(true);
      expect(component.allChecked).toBeTrue();
      component.setChecked('r0', false);
      expect(component.checkedCount).toBe(1);
      expect(component.allChecked).toBeFalse();
      component.setAllChecked(false);
      expect(component.checkedCount).toBe(0);
      expect(localStorage.getItem(CHECKED_REACTIONS_KEY + 's1')).toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('remembers the choice for the annotation, so it is still there when the curator comes back', fakeAsync(() => {
      make(); component.ngOnInit(); tick(0);
      component.setChecked('r1', true);
      component.ngOnDestroy(); discardPeriodicTasks();
      const again = new WorkspaceComponent(api, { paramMap: of(convertToParamMap({ id: 's1' })) } as unknown as ActivatedRoute,
                                           location, dialog, snack, userInstances, references);
      again.ngOnInit(); tick(0);
      expect(again.isChecked('r1')).toBeTrue();
      expect(again.checkedCount).toBe(1);
      again.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('does not count a checked reaction the annotation no longer has, nor one the export cannot load', fakeAsync(() => {
      localStorage.setItem(CHECKED_REACTIONS_KEY + 's1', JSON.stringify(['r0', 'gone']));
      make();
      const s = session('ready');
      api.session.and.returnValue(of({ ...s, reactions: [...s.reactions, { key: 'r2', name: 'No id', dbId: null, evidenceIds: [] }] }));
      component.ngOnInit(); tick(0);
      expect(component.checkedCount).toBe(1);
      expect(component.canCheck('r2')).toBeFalse();
      component.setAllChecked(true);
      expect(component.checkedCount).toBe(2);                       // r0 and r1; r2 has no dbId to load by
      component.ngOnDestroy(); discardPeriodicTasks();
    }));
  });

  it('asks the usage tab to reload when a chat turn ends and when the session is reloaded', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    const before = component.usageStamp;
    component.onTurnDone();
    expect(component.usageStamp).toBe(before + 1);
    component.reload();
    expect(component.usageStamp).toBe(before + 2);                        // a reaction check or an edit also goes through reload()
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('marks staging stale only when an accepted edit arrives, and reloads either way', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    const p = (status: Proposal['status']) => ({ id: 'p-001', status } as Proposal);
    api.issues.calls.reset();
    component.onProposalDecided(p('rejected'));
    expect(component.stagingStale).toBeFalse();
    component.onProposalDecided(p('accepted'));
    expect(component.stagingStale).toBeTrue();
    expect(api.issues).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
  it('lists only the suggestions the service made, named by their reaction, and refreshes them after a decision', fakeAsync(() => {
    make();
    component.ngOnInit();
    tick(0);
    expect(component.suggestions.map(p => p.id)).toEqual(['p-001']);          // the chat proposal is not a suggestion
    expect(component.suggestionReaction(component.suggestions[0])).toBe('PINK1 phosphorylates Ub');
    api.proposals.and.returnValue(of([]));
    component.onProposalDecided({ ...suggestion('p-001', 'r0'), status: 'rejected' });
    expect(component.suggestions).toEqual([]);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
  describe('the divider between the network and the reaction panel', () => {
    // a split 1000px wide whose right edge is at x = 1100
    const split = { getBoundingClientRect: () => ({ right: 1100 }), clientWidth: 1000 } as unknown as HTMLElement;
    const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: jasmine.createSpy('preventDefault') } as unknown as KeyboardEvent);

    beforeEach(() => localStorage.removeItem(WorkspaceComponent.DETAIL_WIDTH_KEY));

    it('starts at the default width, or at the width the curator left it', () => {
      make();
      expect(component.detailWidth).toBe(WorkspaceComponent.DEFAULT_DETAIL_WIDTH);
      const again = () => new WorkspaceComponent(api, {} as ActivatedRoute, location, dialog, snack, userInstances, references).detailWidth;
      localStorage.setItem(WorkspaceComponent.DETAIL_WIDTH_KEY, '520');
      expect(again()).toBe(520);
      localStorage.setItem(WorkspaceComponent.DETAIL_WIDTH_KEY, 'junk');
      expect(again()).toBe(WorkspaceComponent.DEFAULT_DETAIL_WIDTH);
    });

    it('gives the panel the space from the pointer to the right edge, but never squeezes either side away', () => {
      make();
      component.resizeTo(600, split);
      expect(component.detailWidth).toBe(500);
      component.resizeTo(1090, split);
      expect(component.detailWidth).toBe(WorkspaceComponent.MIN_DETAIL_WIDTH);
      component.resizeTo(150, split);
      expect(component.detailWidth).toBe(1000 - WorkspaceComponent.MIN_NETWORK_WIDTH);
    });

    it('moves with the arrow keys, goes back with Home, and remembers the width', () => {
      make();
      const left = key('ArrowLeft');
      component.nudgeDivider(left, split);
      expect(component.detailWidth).toBe(400);
      expect(left.preventDefault).toHaveBeenCalled();
      component.nudgeDivider(key('ArrowRight', true), split);
      expect(component.detailWidth).toBe(320);
      expect(localStorage.getItem(WorkspaceComponent.DETAIL_WIDTH_KEY)).toBe('320');
      component.nudgeDivider(key('Home'), split);
      expect(component.detailWidth).toBe(WorkspaceComponent.DEFAULT_DETAIL_WIDTH);
      const other = key('a');
      component.nudgeDivider(other, split);
      expect(other.preventDefault).not.toHaveBeenCalled();
    });

    it('goes back to the default width on reset', () => {
      make();
      component.resizeTo(500, split);
      component.resetDetailWidth();
      expect(component.detailWidth).toBe(WorkspaceComponent.DEFAULT_DETAIL_WIDTH);
      expect(localStorage.getItem(WorkspaceComponent.DETAIL_WIDTH_KEY)).toBe(String(WorkspaceComponent.DEFAULT_DETAIL_WIDTH));
    });
  });
});
