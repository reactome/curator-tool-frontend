import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { SessionDetail } from './models/llm-api.models';
import { LlmApiService } from './services/llm-api.service';
import { PaperAnnotationModule } from './paper-annotation.module';
import { SessionListComponent } from './components/session-list/session-list.component';
import { WorkspaceComponent } from './components/workspace/workspace.component';

/**
 * Screens that stand alone on a page (the list, "annotating…", "failed") are centred. Measured in real Chrome with the
 * app's global styles, on a body forced to a desktop width: a narrow test window would hide an off-centre layout.
 */
describe('page layout', () => {
  const session = (status: SessionDetail['status'], extra: Partial<SessionDetail> = {}): SessionDetail => ({
    id: 's1', pmid: '24751536', source: '24751536', status, progress: 'extracting and merging reactions (several minutes)',
    created: 1, updated: 2, n_reactions: 0, n_open_issues: 0, focus: 'PINK1', error: null, reactions: [], ...extra });
  let api: jasmine.SpyObj<LlmApiService>;

  beforeEach(() => {
    document.body.style.width = '1600px';
    api = jasmine.createSpyObj('LlmApiService', ['sessions', 'session', 'issues', 'existing']);
    api.sessions.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: LlmApiService, useValue: api },
        { provide: UserInstancesService, useValue: jasmine.createSpyObj('UserInstancesService', ['stagedCount', 'loadAnnotationInstances']) },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 's1' })) } }]
    });
  });
  afterEach(() => { document.body.style.width = ''; });

  /** How far the element's horizontal centre is from the body's, in pixels. */
  const off = (el: Element) => {
    const r = el.getBoundingClientRect();
    const b = document.body.getBoundingClientRect();
    return Math.abs((r.left + r.width / 2) - (b.left + b.width / 2));
  };

  const workspace = (s: SessionDetail) => {
    api.session.and.returnValue(of(s));
    const f = TestBed.createComponent(WorkspaceComponent);
    f.detectChanges();
    tick(0);
    f.detectChanges();
    f.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
    return f.nativeElement as HTMLElement;
  };

  it('centres the session list', () => {
    const f = TestBed.createComponent(SessionListComponent);
    f.detectChanges();
    expect(off(f.nativeElement.querySelector('.page'))).toBeLessThan(2);
  });

  it('centres the "annotating" screen and its text', fakeAsync(() => {
    const el = workspace(session('running'));
    const running = el.querySelector('.running')!;
    expect(running).not.toBeNull();
    expect(off(running)).toBeLessThan(2);
    expect(getComputedStyle(running).textAlign).toBe('center');
    for (const part of ['h2', 'mat-progress-bar', '.step', '.hint'])
      expect(off(running.querySelector(part)!)).withContext(part).toBeLessThan(2);
    expect(running.querySelector('.step')!.textContent).toContain('extracting and merging');
  }));

  it('centres the "queued" screen the same way', fakeAsync(() => {
    const running = workspace(session('queued', { progress: 'starting' })).querySelector('.running')!;
    expect(off(running)).toBeLessThan(2);
  }));

  it('centres the failed screen and says why', fakeAsync(() => {
    const failed = workspace(session('failed', { error: 'RuntimeError: no open-access full text' })).querySelector('.failed')!;
    expect(off(failed)).toBeLessThan(2);
    expect(getComputedStyle(failed).textAlign).toBe('center');
    expect(failed.textContent).toContain('no open-access full text');
  }));

  it('keeps the screen from sitting at the very top', fakeAsync(() => {
    const running = workspace(session('running')).querySelector('.running')!;
    expect(running.getBoundingClientRect().top).toBeGreaterThan(60);
  }));
});
