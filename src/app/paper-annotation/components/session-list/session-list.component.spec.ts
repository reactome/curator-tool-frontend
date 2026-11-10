import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { CandidatePaper, GeneSearchResult, Job, SessionSummary } from '../../models/llm-api.models';
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

  beforeEach(() => sessionStorage.removeItem('paper2path.geneSearch'));
  afterEach(() => sessionStorage.removeItem('paper2path.geneSearch'));

  const create = (sessions: SessionSummary[] | Error = []) => {
    api = jasmine.createSpyObj('LlmApiService', ['sessions', 'startPapers', 'findPapersByGene', 'pollGeneSearch', 'deleteSession',
                                                 'identifyPaper']);
    api.identifyPaper.and.returnValue(of({ found: false, note: 'nothing matched' }));
    api.sessions.and.returnValue(sessions instanceof Error ? throwError(() => sessions) : of(sessions));
    api.pollGeneSearch.and.returnValue(NEVER);                     // a search resumed on entry just keeps running
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
    expect(api.startPapers).toHaveBeenCalledWith(['24751536'], [], 'PINK1', [], new Map());
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
    expect(api.startPapers).toHaveBeenCalledWith(['24751536', '29168502', '1234567'], [], undefined, [], new Map());   // no focus when blank
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
    expect(api.startPapers).toHaveBeenCalledWith(['24751536'], [b, a], undefined, [], new Map());
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('sends the PDFs ticked as reviews, and forgets a removed one', fakeAsync(() => {
    create();
    tick(0);
    api.startPapers.and.returnValue(of({ sessionId: 's4', jobId: 'j4' }));
    const a = new File(['%PDF-a'], 'a.pdf', { type: 'application/pdf' });
    const r = new File(['%PDF-r'], 'review.pdf', { type: 'application/pdf' });
    const gone = new File(['%PDF-g'], 'gone.pdf', { type: 'application/pdf' });
    component.files.push(a, r, gone);
    component.setReview(r, true);
    component.setReview(gone, true);
    component.setReview(a, true);
    component.setReview(a, false);
    component.removeFile(2);
    component.start();
    expect(api.startPapers).toHaveBeenCalledWith([], [a, r], undefined, [r], new Map());
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('looks up each added PDF in PubMed, keeps or replaces the ID as the curator edits it, and sends it with the PDF', fakeAsync(() => {
    create();
    tick(0);
    const found = new Subject<any>();
    api.identifyPaper.and.returnValues(found, of({ found: false, note: 'nothing matched' }));
    api.startPapers.and.returnValue(of({ sessionId: 's5', jobId: 'j5' }));
    const a = new File(['%PDF-a'], 'tp53.pdf', { type: 'application/pdf' });
    const b = new File(['%PDF-b'], 'preprint.pdf', { type: 'application/pdf' });
    component.onFilesChosen({ target: { files: [a, b], value: 'x' } } as unknown as Event);
    expect(api.identifyPaper).toHaveBeenCalledTimes(2);
    expect(component.pdfIds.get(a)?.status).toBe('checking');
    expect(component.pdfIdNote(b)).toContain('Not found in PubMed');
    found.next({ found: true, pmid: '33824975', title: 'Intact TP-53 function', method: 'doi' });
    expect(component.pdfIds.get(a)?.pmid).toBe('33824975');
    expect(component.pdfIdNote(a)).toBe('Found by its DOI: Intact TP-53 function');
    fixture.detectChanges();
    expect(el().querySelector('.file-pmid-note.found')?.textContent).toContain('Found by its DOI');
    component.setPdfPmid(b, '12x');                                  // not a number: Annotate is disabled
    expect(component.pdfPmidsValid).toBeFalse();
    expect(component.canStart).toBeFalse();
    component.setPdfPmid(b, '');
    component.start();
    expect(api.startPapers).toHaveBeenCalledWith([], [a, b], undefined, [], new Map([[a, '33824975']]));
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('keeps an ID the curator typed before the lookup answered, and forgets a removed PDF', fakeAsync(() => {
    create();
    tick(0);
    const found = new Subject<any>();
    api.identifyPaper.and.returnValue(found);
    const a = new File(['%PDF-a'], 'a.pdf', { type: 'application/pdf' });
    component.onFilesChosen({ target: { files: [a], value: 'x' } } as unknown as Event);
    component.setPdfPmid(a, '111');
    found.next({ found: true, pmid: '222', title: 'Other', method: 'title' });
    expect(component.pdfIds.get(a)?.pmid).toBe('111');
    expect(component.pdfIdNote(a)).toBe('Found by its title: PMID 222, Other');
    component.removeFile(0);
    expect(component.pdfIds.has(a)).toBeFalse();
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  it('shows one start form that takes several PubMed IDs and PDFs, lists the chosen PDFs, and enables Annotate only when there is something valid', fakeAsync(() => {
    create();
    tick(0);
    const button = () => el().querySelector('.start-card mat-card-actions button') as HTMLButtonElement;
    expect(el().querySelectorAll('.starters mat-card.start-card').length).toBe(1);
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

  describe('delete', () => {
    const rows = () => el().querySelectorAll('table.sessions tbody tr');
    const button = (row: Element, sel: string) => row.querySelector(sel) as HTMLButtonElement;

    it('asks in the row, then deletes the annotation and drops its row, without opening it', fakeAsync(() => {
      create([summary('a', 'ready'), summary('b', 'failed')]);
      tick(0); fixture.detectChanges();
      api.deleteSession.and.returnValue(of(undefined));
      button(rows()[0], 'button.delete').click();
      fixture.detectChanges();
      expect(api.deleteSession).not.toHaveBeenCalled();
      expect(rows()[0].textContent).toContain('Delete for good?');
      button(rows()[0], 'button.confirm').click();
      fixture.detectChanges();
      expect(api.deleteSession).toHaveBeenCalledWith('a');
      expect(rows().length).toBe(1);
      expect(component.sessions.map(x => x.id)).toEqual(['b']);
      expect(router.navigate).not.toHaveBeenCalled();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('cancel keeps the annotation', fakeAsync(() => {
      create([summary('a', 'ready')]);
      tick(0); fixture.detectChanges();
      button(rows()[0], 'button.delete').click();
      fixture.detectChanges();
      button(rows()[0], 'button.cancel').click();
      fixture.detectChanges();
      expect(api.deleteSession).not.toHaveBeenCalled();
      expect(rows().length).toBe(1);
      expect(button(rows()[0], 'button.delete')).not.toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('cannot delete one that is still running', fakeAsync(() => {
      create([summary('a', 'running'), summary('b', 'queued')]);
      tick(0); fixture.detectChanges();
      expect(button(rows()[0], 'button.delete').disabled).toBeTrue();
      expect(button(rows()[1], 'button.delete').disabled).toBeTrue();
      component.askDelete(component.sessions[0]);
      expect(component.confirmingDeleteId).toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('says why when the service refuses, and keeps the row', fakeAsync(() => {
      create([summary('a', 'ready')]);
      tick(0); fixture.detectChanges();
      api.deleteSession.and.returnValue(throwError(() => new LlmApiError(409, 'This annotation is still running.')));
      component.askDelete(component.sessions[0]);
      component.confirmDelete(component.sessions[0]);
      fixture.detectChanges();
      expect(el().querySelector('.error')?.textContent).toContain('still running');
      expect(rows().length).toBe(1);
      expect(component.confirmingDeleteId).toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));
  });

  it('hides "Find papers for a gene" for the time being, and does not resume a saved search', fakeAsync(() => {
    sessionStorage.setItem('paper2path.geneSearch', JSON.stringify({ jobId: 'g1', gene: 'PINK1' }));
    create();
    tick(0); fixture.detectChanges();
    expect(el().querySelector('.gene-card')).toBeNull();
    expect(api.pollGeneSearch).not.toHaveBeenCalled();
    component.ngOnDestroy(); discardPeriodicTasks();
  }));

  describe('gene -> papers', () => {
    // The card is hidden for the time being; these tests cover it with the flag switched back on.
    beforeEach(() => SessionListComponent.geneSearchEnabled = true);
    afterEach(() => SessionListComponent.geneSearchEnabled = false);

    const paper = (pmid: string, extra: Partial<CandidatePaper> = {}): CandidatePaper => ({
      pmid, title: `paper ${pmid}`, journal: 'J', year: '2014', pmcid: 'PMC1', score: 8, evidence_type: 'DIRECT',
      annotatable: true, justification: `why ${pmid}`, ...extra });
    const result = (papers: CandidatePaper[]): GeneSearchResult =>
      ({ gene: 'PINK1', accession: 'Q9BXM7', pool_size: 120, candidate_pool: 50, dropped_below_threshold: 0, papers });
    const job = (status: Job['status'], progress: string, res: GeneSearchResult | null = null, error: string | null = null): Job<GeneSearchResult> =>
      ({ id: 'g1', status, progress, error, result: res });

    it('searches, shows the progress, then the candidates with the PMC ones ticked, and annotates the ticked ones with the gene as focus', fakeAsync(() => {
      create();
      tick(0);
      const polls = new Subject<Job<GeneSearchResult>>();
      api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
      api.pollGeneSearch.and.returnValue(polls);
      api.startPapers.and.returnValue(of({ sessionId: 's7', jobId: 'j7' }));
      component.gene = ' pink1 ';
      fixture.detectChanges();
      component.searchGene();
      expect(api.findPapersByGene).toHaveBeenCalledWith('PINK1');
      expect(api.pollGeneSearch).toHaveBeenCalledWith('g1');
      expect(JSON.parse(sessionStorage.getItem('paper2path.geneSearch')!)).toEqual({ jobId: 'g1', gene: 'PINK1' });
      polls.next(job('running', 'judging 50 candidate papers'));
      fixture.detectChanges();
      expect(el().querySelector('.gene-running')?.textContent).toContain('judging 50 candidate papers');
      polls.next(job('done', 'done', result([paper('1', { score: 9 }), paper('2', { pmcid: null }), paper('3', { annotatable: false })])));
      fixture.detectChanges();
      expect(el().querySelector('.gene-running')).toBeNull();
      const items = el().querySelectorAll('.candidate');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toContain('paper 1');
      expect(items[0].textContent).toContain('2014');
      expect(items[0].textContent).toContain('score 9/10');
      expect(items[0].textContent).toContain('DIRECT');
      expect(items[0].textContent).toContain('why 1');
      expect(items[1].textContent).toContain('Not in PubMed Central');
      expect(component.selectedCandidates).toEqual(['1']);           // no PMC text, or judged unannotatable: not ticked
      component.toggleCandidate(paper('2', { pmcid: null }), true);   // cannot be ticked
      component.toggleCandidate(paper('3'), true);
      expect(component.selectedCandidates).toEqual(['1', '3']);
      component.annotateSelected();
      expect(api.startPapers).toHaveBeenCalledWith(['1', '3'], [], 'PINK1');
      expect(router.navigate).toHaveBeenCalledWith(['s7'], { relativeTo: jasmine.anything() });
      expect(sessionStorage.getItem('paper2path.geneSearch')).toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('refuses what is not a gene symbol', fakeAsync(() => {
      create();
      tick(0);
      for (const bad of ['', '   ', 'PINK1 OR BRCA1', '-PINK1', '"PINK1"']) {
        component.gene = bad;
        component.searchGene();
      }
      expect(api.findPapersByGene).not.toHaveBeenCalled();
      component.gene = 'PINK1;rm';
      fixture.detectChanges();
      expect(el().querySelector('.gene-card .invalid')).not.toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('says why a search failed and forgets it', fakeAsync(() => {
      create();
      tick(0);
      api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
      api.pollGeneSearch.and.returnValue(of(job('failed', 'searching PubMed', null, 'PubMed is down')));
      component.gene = 'PINK1';
      component.searchGene();
      fixture.detectChanges();
      expect(component.geneSearching).toBeFalse();
      expect(el().querySelector('.error')?.textContent).toContain('PubMed is down');
      expect(sessionStorage.getItem('paper2path.geneSearch')).toBeNull();
      component.ngOnDestroy(); discardPeriodicTasks();
    }));

    it('picks a running search up again after the page is left and reopened', fakeAsync(() => {
      sessionStorage.setItem('paper2path.geneSearch', JSON.stringify({ jobId: 'g5', gene: 'PRKN' }));
      create();
      tick(0);
      expect(component.gene).toBe('PRKN');
      expect(api.pollGeneSearch).toHaveBeenCalledWith('g5');
      component.ngOnDestroy(); discardPeriodicTasks();
    }));
  });
});
