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
    api = jasmine.createSpyObj('LlmApiService', ['sessions', 'startPapers']);
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

  it('validates the PubMed IDs and only starts valid ones, opening the new session', fakeAsync(() => {
    create();
    tick(0);
    api.startPapers.and.returnValue(of({ sessionId: 's9', jobId: 'j9' }));
    for (const bad of ['', 'abc', '12 x', '1234567890', '24751536 oops']) {
      component.pmids = bad;
      component.start();
    }
    expect(api.startPapers).not.toHaveBeenCalled();
    component.pmids = ' 24751536 ';
    component.focus = ' PINK1 ';
    component.start();
    expect(api.startPapers).toHaveBeenCalledWith(['24751536'], [], 'PINK1');
    expect(router.navigate).toHaveBeenCalledWith(['s9'], { relativeTo: jasmine.anything() });
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('takes several PubMed IDs separated by spaces, commas or new lines, each once', fakeAsync(() => {
    create();
    tick(0);
    api.startPapers.and.returnValue(of({ sessionId: 's3', jobId: 'j3' }));
    component.pmids = '24751536, 29168502\n24751536;1234567';
    expect(component.pmidList).toEqual(['24751536', '29168502', '1234567']);
    expect(component.summary).toBe('3 PubMed IDs');
    component.start();
    expect(api.startPapers).toHaveBeenCalledWith(['24751536', '29168502', '1234567'], [], undefined);   // no focus when blank
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('collects several PDFs, keeps each once, lets one be removed, and starts them with the PubMed IDs', fakeAsync(() => {
    create();
    tick(0);
    api.startPapers.and.returnValue(of({ sessionId: 's2', jobId: 'j2' }));
    component.start();
    expect(api.startPapers).not.toHaveBeenCalled();                    // nothing chosen yet
    const a = new File(['%PDF-a'], 'a.pdf', { type: 'application/pdf' });
    const b = new File(['%PDF-b'], 'b.pdf', { type: 'application/pdf' });
    const picker = { files: [a, b], value: 'C:\\fakepath\\a.pdf' };
    component.onFilesChosen({ target: picker } as unknown as Event);
    component.onFilesChosen({ target: { files: [a], value: 'x' } } as unknown as Event);     // the same file again
    expect(component.files).toEqual([a, b]);
    expect(picker.value).toBe('');                                     // the picker is cleared so it can be used again
    component.removeFile(0);
    expect(component.files).toEqual([b]);
    component.files.push(a);
    component.pmids = '24751536';
    expect(component.summary).toBe('2 PDFs + 1 PubMed ID');
    component.start();
    expect(api.startPapers).toHaveBeenCalledWith(['24751536'], [b, a], undefined);
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('shows one start form that takes several PubMed IDs and PDFs, lists the chosen PDFs, and enables Annotate only when there is something valid', fakeAsync(() => {
    create();
    tick(0);
    const button = () => Array.from(el().querySelectorAll('mat-card-actions button')).find(b => b.textContent?.includes('Annotate')) as HTMLButtonElement;
    expect(el().querySelectorAll('.starters mat-card').length).toBe(1);
    expect((el().querySelector('input[type=file]') as HTMLInputElement).multiple).toBeTrue();     // several PDFs can be picked at once
    expect(el().querySelector('textarea')).not.toBeNull();
    expect(button().disabled).toBeTrue();                                                          // nothing to annotate yet
    component.pmids = '24751536 29168502';
    fixture.detectChanges();
    expect(button().disabled).toBeFalse();
    expect(el().querySelector('.count')?.textContent).toContain('2 PubMed IDs');
    component.pmids = '24751536 nope';
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
    expect(el().querySelector('.invalid')?.textContent).toContain('must be a number');
    component.pmids = '';
    component.files = [new File(['%PDF-a'], 'first.pdf'), new File(['%PDF-b'], 'second.pdf')];
    fixture.detectChanges();
    expect(Array.from(el().querySelectorAll('.files .file-name')).map(n => n.textContent)).toEqual(['first.pdf', 'second.pdf']);
    expect(button().disabled).toBeFalse();
    (el().querySelector('.files button') as HTMLButtonElement).click();                            // remove the first
    fixture.detectChanges();
    expect(component.files.map(f => f.name)).toEqual(['second.pdf']);
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('names several papers by the service summary and one paper by its PMID or file', fakeAsync(() => {
    create();
    tick(0);
    const base = summary('s1', 'ready');
    expect(component.label({ ...base, pmid: '24751536', source: '24751536', n_papers: 1 })).toBe('PMID 24751536');
    expect(component.label({ ...base, pmid: null, source: 'paper.pdf' })).toBe('paper.pdf');             // an older service sends no n_papers
    expect(component.label({ ...base, pmid: '24751536', source: '3 papers: a.pdf, b.pdf, 24751536', n_papers: 3 })).toBe('3 papers: a.pdf, b.pdf, 24751536');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('keeps the form usable and says why when starting fails', fakeAsync(() => {
    create();
    tick(0);
    api.startPapers.and.returnValue(throwError(() => new LlmApiError(403, 'Your account may not use the annotation service (curator role required).')));
    component.pmids = '24751536';
    component.start();
    fixture.detectChanges();
    expect(component.starting).toBeFalse();
    expect(el().querySelector('.error')?.textContent).toContain('curator role required');
    component.ngOnDestroy(); discardPeriodicTasks();
  }));
});
