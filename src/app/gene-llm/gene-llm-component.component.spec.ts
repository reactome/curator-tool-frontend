import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { PageTitleService } from 'src/app/core/services/page-title.service';
import { GenePathwaysResult, Job } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { componentTestImports } from 'src/testing';
import { DEFAULT_LLM_CONFIG } from './components/configuration-component/configuration-component.component';
import { GeneLlmComponentComponent } from './gene-llm-component.component';

describe('GeneLlmComponentComponent', () => {
  let component: GeneLlmComponentComponent;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  let api: jasmine.SpyObj<LlmApiService>;
  let savedToken: string | null;

  const result = (extra: Partial<GenePathwaysResult> = {}): GenePathwaysResult => ({
    gene: 'PINK1', status: 'ok', confident: true,
    annotated_pathways: [{ pathway_id: 5205647, pathway_name: 'Mitophagy' }],
    predicted_pathways: [
      { pathway_id: 9013419, pathway_name: 'Miro GTPase Cycle', fdr: 6.25e-4, overlap_count: 2, mapped_genes: ['RHOT1', 'RHOT2'], annotated: false },
      { pathway_id: 5205647, pathway_name: 'Mitophagy', fdr: 4.9e-3, overlap_count: 2, mapped_genes: ['SQSTM1', 'ULK1'], annotated: true },
    ],
    partners: [{ gene: 'PRKN', score: 0.99 }],
    params: { fi_cutoff: 0.8, top_partners: 10, fdr_cutoff: 0.05, max_pathways: 8 },
    ...extra });
  const job = (status: Job['status'], res: GenePathwaysResult | null = null, error: string | null = null): Job<GenePathwaysResult> =>
    ({ id: 'p1', status, progress: status === 'running' ? 'ranking its functional-interaction partners' : status, error, result: res });

  beforeEach(() => {
    savedToken = localStorage.getItem('token');
    localStorage.setItem('token', 'a-token');
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);
    api = jasmine.createSpyObj('LlmApiService', ['findPathwaysByGene', 'pollPathwaySearch']);
    api.findPathwaysByGene.and.returnValue(of({ jobId: 'p1' }));

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        GeneLlmComponentComponent,
        { provide: PageTitleService, useValue: pageTitle },
        { provide: LlmApiService, useValue: api },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    component = TestBed.inject(GeneLlmComponentComponent);
  });

  afterEach(() => {
    component.ngOnDestroy();
    if (savedToken === null) localStorage.removeItem('token'); else localStorage.setItem('token', savedToken);
  });

  it('sets the page title to Gene2Path', () => {
    expect(pageTitle.setTitle).toHaveBeenCalledWith('Gene2Path');
  });

  it('starts from a copy of the default configuration', () => {
    // Bound to the form, so it must not be the shared module-level default.
    expect(component.configuration).toEqual(DEFAULT_LLM_CONFIG);
    expect(component.configuration).not.toBe(DEFAULT_LLM_CONFIG);
    expect(component.showConfiguration).toBeFalse();
  });

  it('toggles the configuration panel', () => {
    component.changeShowConfiguration();
    expect(component.showConfiguration).toBeTrue();
    component.changeShowConfiguration();
    expect(component.showConfiguration).toBeFalse();
  });

  it('searches for the gene with the settings, shows the progress, then the result, and starts the paper search too', () => {
    const polls = new Subject<Job<GenePathwaysResult>>();
    api.pollPathwaySearch.and.returnValue(polls);
    component.gene = ' pink1 ';
    component.configuration.fdr_cutoff = 0.01;

    component.run();

    expect(api.findPathwaysByGene).toHaveBeenCalledWith('PINK1', { ...DEFAULT_LLM_CONFIG, fdr_cutoff: 0.01 });
    expect(api.pollPathwaySearch).toHaveBeenCalledWith('p1');
    expect(component.paperQuery).toEqual({ gene: 'PINK1' });
    expect(component.searching).toBeTrue();
    polls.next(job('running'));
    expect(component.progress).toBe('ranking its functional-interaction partners');
    polls.next(job('done', result()));
    expect(component.searching).toBeFalse();
    expect(component.result?.predicted_pathways.length).toBe(2);
    expect(component.newPredictions).toBe(1);                    // Mitophagy is already annotated
    expect(component.sections.map(s => s.id)).toEqual(['annotated_pathways', 'predicted_pathways', 'fi_partners', 'relevant_papers']);
  });

  it('starts a new paper search each run, even for the same gene', () => {
    api.pollPathwaySearch.and.returnValue(of(job('done', result())));
    component.gene = 'PINK1';
    component.run();
    const first = component.paperQuery;
    component.run();
    expect(component.paperQuery).toEqual(first);
    expect(component.paperQuery).not.toBe(first);
  });

  it('does not run without a gene, or without a login', () => {
    component.gene = '   ';
    component.run();
    localStorage.removeItem('token');
    component.gene = 'PINK1';
    component.run();
    expect(api.findPathwaysByGene).not.toHaveBeenCalled();
    expect(component.hasRun).toBeFalse();
  });

  it('says why a search failed', () => {
    api.pollPathwaySearch.and.returnValue(of(job('failed', null, 'Neo4j is down')));
    component.gene = 'PINK1';
    component.run();
    expect(component.searching).toBeFalse();
    expect(component.failure).toContain('Neo4j is down');
  });

  it('says so when the service cannot be reached, rather than logging the curator out', () => {
    api.findPathwaysByGene.and.returnValue(throwError(() => new LlmApiError(0, 'The annotation service is not reachable.')));
    component.gene = 'PINK1';
    component.run();
    expect(component.searching).toBeFalse();
    expect(component.failure).toContain('not reachable');
  });

  it('formats an FDR as it was shown before', () => {
    expect(component.formatFdr(6.2e-4)).toBe('6.2E-4');
    expect(component.formatFdr(0.0049)).toBe('4.9E-3');
  });

  it('links a pathway to the Pathway Browser by its dbId', () => {
    expect(component.pathwayUrl(5205647)).toBe('https://reactome.org/PathwayBrowser/#/5205647');
  });
});
