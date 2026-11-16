import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { PageTitleService } from 'src/app/core/services/page-title.service';
import { GenePathwaysResult, Job, PathwayEvidence } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { componentTestImports } from 'src/testing';
import { DEFAULT_LLM_CONFIG } from './components/configuration-component/configuration-component.component';
import { GeneLlmComponentComponent, splitCitations } from './gene-llm-component.component';

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
    api = jasmine.createSpyObj('LlmApiService', ['findPathwaysByGene', 'pollPathwaySearch', 'startPartnerPapers']);
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

  it('searches for the gene with the settings, shows the progress, then the result', () => {
    const polls = new Subject<Job<GenePathwaysResult>>();
    api.pollPathwaySearch.and.returnValue(polls);
    component.gene = ' pink1 ';
    component.configuration.fdr_cutoff = 0.01;

    component.run();

    expect(api.findPathwaysByGene).toHaveBeenCalledWith('PINK1', { ...DEFAULT_LLM_CONFIG, fdr_cutoff: 0.01 });
    expect(api.pollPathwaySearch).toHaveBeenCalledWith('p1');
    expect(component.searching).toBeTrue();
    polls.next(job('running'));
    expect(component.progress).toBe('ranking its functional-interaction partners');
    polls.next(job('done', result()));
    expect(component.searching).toBeFalse();
    expect(component.result?.predicted_pathways.length).toBe(2);
    expect(component.newPredictions).toBe(1);                    // Mitophagy is already annotated
    expect(component.sections.map(s => s.id)).toEqual(['annotated_pathways', 'predicted_pathways', 'fi_partners']);
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

  it('opens and closes a pathway\'s literature, and closes them all on a new run', () => {
    api.pollPathwaySearch.and.returnValue(of(job('done', result())));
    component.toggleEvidence(9013419);
    component.toggleEvidence(5205647);
    expect([...component.openEvidence]).toEqual([9013419, 5205647]);
    component.toggleEvidence(9013419);
    expect([...component.openEvidence]).toEqual([5205647]);
    component.gene = 'PINK1';
    component.run();
    expect(component.openEvidence.size).toBe(0);
  });

  it('keeps each pathway\'s literature from the result', () => {
    const evidence = [{ pmid: '22078885', title: 'PINK1 and Parkin target Miro', journal: 'Cell', year: '2011',
      pmcid: 'PMC3261796', partners_mentioned: ['RHOT1'], terms_mentioned: ['GTPase'], sentences: ['PINK1 phosphorylates RHOT1.'] }];
    const r = result();
    r.predicted_pathways[0] = { ...r.predicted_pathways[0], evidence, evidence_count: 41 };
    api.pollPathwaySearch.and.returnValue(of(job('done', r)));
    component.gene = 'PINK1';
    component.run();
    expect(component.result?.predicted_pathways[0].evidence?.[0].sentences).toEqual(['PINK1 phosphorylates RHOT1.']);
    expect(component.result?.predicted_pathways[0].evidence_count).toBe(41);
  });

  it('splits each pathway\'s summary into text and PubMed citations once the result arrives, and clears them on a new run', () => {
    const r = result();
    r.predicted_pathways[0] = { ...r.predicted_pathways[0], summary: 'PINK1 phosphorylates RHOT1 [PMID:22078885].' };
    r.predicted_pathways[1] = { ...r.predicted_pathways[1], summary_error: 'RuntimeError: overloaded' };
    const polls = new Subject<Job<GenePathwaysResult>>();
    api.pollPathwaySearch.and.returnValue(polls);
    component.gene = 'PINK1';
    component.run();
    polls.next(job('done', r));
    expect(component.summaries.get(9013419)).toEqual([
      { text: 'PINK1 phosphorylates RHOT1 ' }, { text: 'PMID 22078885', pmid: '22078885' }, { text: '.' }]);
    expect(component.summaries.has(5205647)).toBeFalse();       // a failed summary keeps its error on the pathway
    const first = component.summaries.get(9013419);
    component.ngOnDestroy();
    api.pollPathwaySearch.and.returnValue(new Subject<Job<GenePathwaysResult>>());
    component.run();
    expect(component.summaries.size).toBe(0);
    expect(first?.length).toBe(3);
  });

  it('splits citations anywhere in a summary, including back to back', () => {
    expect(splitCitations('[PMID:1][PMID: 2] bind.')).toEqual([
      { text: 'PMID 1', pmid: '1' }, { text: 'PMID 2', pmid: '2' }, { text: ' bind.' }]);
    expect(splitCitations('No citations.')).toEqual([{ text: 'No citations.' }]);
  });

  it('asks for summaries by default, and says the search will take longer only when it writes them', () => {
    expect(component.configuration.summarize).toBeTrue();
    expect(component.summarizing).toBeTrue();
    component.configuration.max_evidence = 0;                   // no papers, nothing to summarize
    expect(component.summarizing).toBeFalse();
    component.configuration.max_evidence = 5;
    component.configuration.summarize = false;
    expect(component.summarizing).toBeFalse();
  });

  it('links a paper to PubMed and its full text to PMC', () => {
    expect(component.pubmedUrl('22078885')).toBe('https://pubmed.ncbi.nlm.nih.gov/22078885/');
    expect(component.pmcUrl('PMC3261796')).toBe('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3261796/');
  });

  it('links a pathway to the Pathway Browser by its dbId', () => {
    expect(component.pathwayUrl(5205647)).toBe('https://reactome.org/PathwayBrowser/#/5205647');
  });

  describe('annotating a partner\'s papers', () => {
    const paper = (pmid: string, pmcid: string | null, relation?: 'direct' | 'indirect' | 'none'): PathwayEvidence => ({
      pmid, title: `Paper ${pmid}`, journal: 'J', year: '2014', pmcid, partners_mentioned: ['PRKN'], terms_mentioned: [],
      sentences: [], check: relation ? { relation, event: relation === 'none' ? '' : 'PINK1 phosphorylates PRKN' } : null });
    const withPartnerPapers = () => {
      const r = result();
      r.predicted_pathways[0] = { ...r.predicted_pathways[0], partner_evidence: [{ partner: 'PRKN', count: 40, papers: [
        paper('1', 'PMC1', 'direct'), paper('2', null, 'direct'), paper('3', 'PMC3', 'indirect'), paper('4', 'PMC4')] }] };
      api.pollPathwaySearch.and.returnValue(of(job('done', r)));
      component.gene = 'PINK1';
      component.run();
      const p = component.result!.predicted_pathways[0];
      return { p, pe: p.partner_evidence![0] };
    };

    it('ticks the papers in PMC judged to describe a direct event', () => {
      const { p, pe } = withPartnerPapers();
      expect(component.selectedPartnerPapers(p, pe)).toEqual(['1']);   // 2 is direct but not in PMC
    });

    it('ticks and unticks papers, but never one without PMC full text', () => {
      const { p, pe } = withPartnerPapers();
      component.togglePartnerPaper(p, pe, pe.papers[3], true);
      component.togglePartnerPaper(p, pe, pe.papers[1], true);
      component.togglePartnerPaper(p, pe, pe.papers[0], false);
      expect(component.selectedPartnerPapers(p, pe)).toEqual(['4']);
      expect(component.isPartnerPaperSelected(p, pe, pe.papers[3])).toBeTrue();
    });

    it('starts one session for the ticked papers with the gene, the partner and the pathway, and links to it', () => {
      const { p, pe } = withPartnerPapers();
      component.togglePartnerPaper(p, pe, pe.papers[2], true);
      api.startPartnerPapers.and.returnValue(of({ sessionId: 's1', jobId: 'j1' }));
      component.annotatePartner(p, pe);
      expect(api.startPartnerPapers).toHaveBeenCalledWith(['1', '3'], 'PINK1', 'PRKN', 9013419);
      expect(component.partnerStarts.get(component.partnerKey(p, pe))).toEqual({ starting: false, sessionId: 's1' });
    });

    it('says why the annotation could not start', () => {
      const { p, pe } = withPartnerPapers();
      api.startPartnerPapers.and.returnValue(throwError(() => new LlmApiError(422, 'at most 5 papers per session')));
      component.annotatePartner(p, pe);
      expect(component.partnerStarts.get(component.partnerKey(p, pe))?.error).toContain('at most 5 papers');
    });

    it('starts nothing with no paper ticked, and forgets the selections on a new run', () => {
      const { p, pe } = withPartnerPapers();
      component.togglePartnerPaper(p, pe, pe.papers[0], false);
      component.annotatePartner(p, pe);
      expect(api.startPartnerPapers).not.toHaveBeenCalled();
      api.pollPathwaySearch.and.returnValue(new Subject<Job<GenePathwaysResult>>());
      component.run();
      expect(component.partnerSelection.size).toBe(0);
      expect(component.partnerStarts.size).toBe(0);
    });

    it('explains the LLM check in the chip tooltip', () => {
      const { pe } = withPartnerPapers();
      expect(component.relationTooltip(pe.papers[0])).toContain('molecular event');
      expect(component.relationTooltip(pe.papers[2])).toContain('no mechanism');
    });
  });
});
