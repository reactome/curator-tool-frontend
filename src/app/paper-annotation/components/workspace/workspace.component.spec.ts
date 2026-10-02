import { Location } from '@angular/common';
import { fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { ExistingMatch, Issue, Proposal, SessionDetail } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { LOADED_SESSION_KEY } from '../../services/staging';
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

  let api: jasmine.SpyObj<any>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let snack: jasmine.SpyObj<MatSnackBar>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;
  let location: jasmine.SpyObj<Location>;
  let openSpy: jasmine.Spy;
  let snackAction: Subject<void>;
  let component: WorkspaceComponent;
  const exported = { newInstances: [{ dbId: -1, schemaClassName: 'Reaction' }, { dbId: -2, schemaClassName: 'Summation' }], updatedInstances: [], deletedInstances: [], bookmarks: [] };

  const make = () => {
    api = jasmine.createSpyObj('LlmApiService', ['session', 'issues', 'existing', 'exportInstances']);
    api.session.and.returnValue(of(session('ready')));
    api.issues.and.returnValue(of([issue('i1', 'r0', 'action'), issue('i2', 'r0', 'warning'), issue('i3', 'r1', 'info', 'dismissed')]));
    api.existing.and.returnValue(of([match('r1', 'same'), match('r0', 'similar')]));
    api.exportInstances.and.returnValue(of(exported));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    snack = jasmine.createSpyObj('MatSnackBar', ['open']);
    snackAction = new Subject<void>();
    snack.open.and.returnValue({ onAction: () => snackAction } as any);
    userInstances = jasmine.createSpyObj('UserInstancesService', ['stagedSummary', 'loadAnnotationInstances']);
    userInstances.stagedSummary.and.returnValue(of({ replaced: 4, keepsDefaultPerson: false, keepsBookmarks: 0 }));
    userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 4, backedUp: true, backupFile: 'b.json', loaded: 2, keptDefaultPerson: false, keptBookmarks: 0 }));
    location = jasmine.createSpyObj('Location', ['prepareExternalUrl']);
    location.prepareExternalUrl.and.callFake((path: string) => `/curatortool${path}`);
    openSpy = spyOn(window, 'open');
    const route = { paramMap: of(convertToParamMap({ id: 's1' })) } as unknown as ActivatedRoute;
    component = new WorkspaceComponent(api, route, location, dialog, snack, userInstances);
    localStorage.removeItem(LOADED_SESSION_KEY);
  };
  const answer = (confirmed: boolean) => dialog.open.and.returnValue({ afterClosed: () => of(confirmed) } as any);

  afterEach(() => localStorage.removeItem(LOADED_SESSION_KEY));

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
    beforeEach(fakeAsync(() => { make(); component.ngOnInit(); tick(0); component.ngOnDestroy(); discardPeriodicTasks(); }));

    it('asks with the real counts, then loads, remembers the session and tells the curator about the backup', () => {
      answer(true);
      component.stagingStale = true;
      component.loadIntoStaging();
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual({ staged: 4, keepsDefaultPerson: false, keepsBookmarks: 0, incoming: 2, stale: true });
      expect(userInstances.stagedSummary).toHaveBeenCalledWith(exported as any);          // judged against what is about to be loaded
      expect(userInstances.loadAnnotationInstances).toHaveBeenCalledWith(exported as any);
      expect(localStorage.getItem(LOADED_SESSION_KEY)).toBe('s1');
      expect(component.stagingStale).toBeFalse();
      expect(component.loading).toBeFalse();
      expect(snack.open.calls.mostRecent().args[0]).toContain('Loaded 2 instances');
      expect(snack.open.calls.mostRecent().args[0]).toContain('b.json');
    });

    it('tells the curator what was kept, in the dialog and afterwards', () => {
      answer(true);
      userInstances.stagedSummary.and.returnValue(of({ replaced: 4, keepsDefaultPerson: true, keepsBookmarks: 3 }));
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 4, backedUp: true, backupFile: 'b.json', loaded: 2, keptDefaultPerson: true, keptBookmarks: 3 }));
      component.loadIntoStaging();
      expect(dialog.open.calls.mostRecent().args[1]!.data).toEqual(jasmine.objectContaining({ staged: 4, keepsDefaultPerson: true, keepsBookmarks: 3 }));
      expect(snack.open.calls.mostRecent().args[0]).toContain('Kept as they are: your default person and 3 bookmarks.');
    });

    it('words a single kept bookmark, and a kept default person alone', () => {
      answer(true);
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 0, backedUp: false, loaded: 2, keptDefaultPerson: false, keptBookmarks: 1 }));
      component.loadIntoStaging();
      expect(snack.open.calls.mostRecent().args[0]).toContain('Kept as they are: your 1 bookmark.');
      userInstances.loadAnnotationInstances.and.returnValue(of({ replaced: 0, backedUp: false, loaded: 2, keptDefaultPerson: true, keptBookmarks: 0 }));
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
  });

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
});
