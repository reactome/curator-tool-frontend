import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { SessionSummary } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { PaperAnnotationModule } from '../../paper-annotation.module';
import { SessionListComponent } from './session-list.component';

describe('SessionListComponent', () => {
  const summary = (id: string, status: SessionSummary['status'], extra: Partial<SessionSummary> = {}): SessionSummary => ({
    id, pmid: '24751536', source: '24751536', status, progress: 'extracting', created: 1700000000, updated: 1700000100,
    n_reactions: 11, n_open_issues: 10, ...extra });

  let api: jasmine.SpyObj<LlmApiService>;
  let router: jasmine.SpyObj<Router>;
  let fixture: ComponentFixture<SessionListComponent>;
  let component: SessionListComponent;
  const el = () => fixture.nativeElement as HTMLElement;

  const create = (sessions: SessionSummary[] | Error = []) => {
    api = jasmine.createSpyObj('LlmApiService', ['sessions', 'start', 'upload']);
    api.sessions.and.returnValue(sessions instanceof Error ? throwError(() => sessions) : of(sessions));
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: LlmApiService, useValue: api }, { provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: {} }]
    });
    fixture = TestBed.createComponent(SessionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('lists sessions with their status, counts only for ready ones, and a plain-language empty state', fakeAsync(() => {
    create([summary('a', 'ready'), summary('b', 'running', { n_reactions: 0, n_open_issues: 0 })]);
    tick(0); fixture.detectChanges();
    const rows = el().querySelectorAll('table.sessions tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('PMID 24751536');
    expect(rows[0].textContent).toContain('11');
    expect(rows[1].textContent).toContain('running');
    expect(rows[1].textContent).toContain('extracting');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('shows the empty state when there are no sessions', fakeAsync(() => {
    create([]);
    tick(0); fixture.detectChanges();
    expect(el().textContent).toContain('Nothing yet');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('keeps refreshing only while something is running', fakeAsync(() => {
    create([summary('a', 'running')]);
    tick(0);
    tick(5000); tick(5000);
    expect(api.sessions.calls.count()).toBe(3);
    api.sessions.and.returnValue(of([summary('a', 'ready')]));
    tick(5000);                                                    // sees it is ready
    const after = api.sessions.calls.count();
    tick(30000);
    expect(api.sessions.calls.count()).toBe(after);                // no more polling
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('shows why the list could not be loaded', fakeAsync(() => {
    create(new LlmApiError(0, 'The annotation service is not reachable. Is curator-tool-llm running?'));
    tick(0); fixture.detectChanges();
    expect(el().querySelector('.error')?.textContent).toContain('not reachable');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('validates the PubMed id and only starts a valid one, opening the new session', fakeAsync(() => {
    create();
    tick(0);
    api.start.and.returnValue(of({ sessionId: 's9', jobId: 'j9' }));
    for (const bad of ['', 'abc', '12 34', '1234567890']) {
      component.pmid = bad;
      component.startFromPmid();
    }
    expect(api.start).not.toHaveBeenCalled();
    component.pmid = ' 24751536 ';
    component.pmidFocus = ' PINK1 ';
    component.startFromPmid();
    expect(api.start).toHaveBeenCalledWith('24751536', 'PINK1');
    expect(router.navigate).toHaveBeenCalledWith(['s9'], { relativeTo: jasmine.anything() });
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('starts a PDF upload and passes no focus when it is blank', fakeAsync(() => {
    create();
    tick(0);
    api.upload.and.returnValue(of({ sessionId: 's2', jobId: 'j2' }));
    component.startFromPdf();
    expect(api.upload).not.toHaveBeenCalled();                    // nothing chosen yet
    const file = new File(['%PDF-1'], 'paper.pdf', { type: 'application/pdf' });
    component.onFileChosen({ target: { files: [file] } } as unknown as Event);
    component.startFromPdf();
    expect(api.upload).toHaveBeenCalledWith(file, undefined);
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('keeps the form usable and says why when starting fails', fakeAsync(() => {
    create();
    tick(0);
    api.start.and.returnValue(throwError(() => new LlmApiError(403, 'Your account may not use the annotation service (curator role required).')));
    component.pmid = '24751536';
    component.startFromPmid();
    fixture.detectChanges();
    expect(component.starting).toBeFalse();
    expect(el().querySelector('.error')?.textContent).toContain('curator role required');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));
});
