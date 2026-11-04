import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatProgressBar } from '@angular/material/progress-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of, throwError } from 'rxjs';
import { SharedModule } from 'src/app/shared/shared.module';
import { CandidatePaper, GeneSearchResult, Job } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { GenePapersComponent } from './gene-papers.component';

describe('GenePapersComponent', () => {
  let fixture: ComponentFixture<GenePapersComponent>;
  let component: GenePapersComponent;
  let api: jasmine.SpyObj<LlmApiService>;
  let savedToken: string | null;
  const el = () => fixture.nativeElement as HTMLElement;

  const paper = (pmid: string, extra: Partial<CandidatePaper> = {}): CandidatePaper => ({
    pmid, title: `paper ${pmid}`, journal: 'J', year: '2014', pmcid: 'PMC1', score: 8, evidence_type: 'DIRECT',
    annotatable: true, justification: `why ${pmid}`, ...extra });
  const result = (papers: CandidatePaper[]): GeneSearchResult =>
    ({ gene: 'PINK1', accession: 'Q9BXM7', pool_size: 120, candidate_pool: 50, dropped_below_threshold: 0, papers });
  const job = (status: Job['status'], progress: string, res: GeneSearchResult | null = null, error: string | null = null): Job<GeneSearchResult> =>
    ({ id: 'g1', status, progress, error, result: res });

  /** Sets the input the way Gene2Path does, through ngOnChanges. */
  const run = (gene: string) => {
    fixture.componentRef.setInput('query', { gene });
    fixture.detectChanges();
  };

  beforeEach(() => {
    savedToken = localStorage.getItem('token');
    localStorage.setItem('token', 'a-token');
    api = jasmine.createSpyObj('LlmApiService', ['findPapersByGene', 'pollGeneSearch', 'startPapers']);
    TestBed.configureTestingModule({
      declarations: [GenePapersComponent],
      imports: [SharedModule, MatProgressBar, NoopAnimationsModule],
      providers: [{ provide: LlmApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(GenePapersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
    if (savedToken === null) localStorage.removeItem('token'); else localStorage.setItem('token', savedToken);
  });

  it('searches for the gene, shows the progress, then the candidates with the PMC ones ticked, and annotates the ticked ones with the gene as focus', () => {
    const polls = new Subject<Job<GeneSearchResult>>();
    api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
    api.pollGeneSearch.and.returnValue(polls);
    api.startPapers.and.returnValue(of({ sessionId: 's7', jobId: 'j7' }));
    run(' pink1 ');
    expect(api.findPapersByGene).toHaveBeenCalledWith('PINK1');
    expect(api.pollGeneSearch).toHaveBeenCalledWith('g1');
    polls.next(job('running', 'judging 50 candidate papers'));
    fixture.detectChanges();
    expect(el().querySelector('.running')?.textContent).toContain('judging 50 candidate papers');
    polls.next(job('done', 'done', result([paper('1', { score: 9 }), paper('2', { pmcid: null }), paper('3', { annotatable: false })])));
    fixture.detectChanges();
    expect(el().querySelector('.running')).toBeNull();
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
    fixture.detectChanges();
    // A link to the new annotation, not a navigation: leaving Gene2Path would lose its results.
    expect(el().querySelector('.started a')?.getAttribute('href')).toBe('paper2path/s7');
  });

  it('searches again when Gene2Path is run again, even for the same gene', () => {
    api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
    api.pollGeneSearch.and.returnValue(of(job('done', 'done', result([paper('1')]))));
    run('PINK1');
    run('PINK1');
    expect(api.findPapersByGene).toHaveBeenCalledTimes(2);
  });

  it('does not search for what is not a gene symbol', () => {
    for (const bad of ['', '   ', 'PINK1 OR BRCA1', '-PINK1', '"PINK1"']) run(bad);
    expect(api.findPapersByGene).not.toHaveBeenCalled();
    run('PINK1;rm');
    expect(el().querySelector('.invalid')).not.toBeNull();
  });

  it('asks the curator to log in rather than searching without a token (Gene2Path is open to anyone)', () => {
    localStorage.removeItem('token');
    run('PINK1');
    expect(api.findPapersByGene).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Log in to WebBench');
  });

  it('says why a search failed', () => {
    api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
    api.pollGeneSearch.and.returnValue(of(job('failed', 'searching PubMed', null, 'PubMed is down')));
    run('PINK1');
    expect(component.searching).toBeFalse();
    expect(el().querySelector('.error')?.textContent).toContain('PubMed is down');
  });

  it('says why starting the annotation failed', () => {
    api.findPapersByGene.and.returnValue(of({ jobId: 'g1' }));
    api.pollGeneSearch.and.returnValue(of(job('done', 'done', result([paper('1')]))));
    api.startPapers.and.returnValue(throwError(() => new LlmApiError(403, 'curator role required')));
    run('PINK1');
    component.annotateSelected();
    fixture.detectChanges();
    expect(component.starting).toBeFalse();
    expect(el().querySelector('.error')?.textContent).toContain('curator role required');
  });
});
