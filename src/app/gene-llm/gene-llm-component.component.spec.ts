import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageTitleService } from 'src/app/core/services/page-title.service';
import { componentTestImports } from 'src/testing';
import { GeneLlmComponentComponent } from './gene-llm-component.component';

describe('GeneLlmComponentComponent', () => {
  let component: GeneLlmComponentComponent;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  /** Reaches the private text-processing helpers, which is where the logic lives. */
  let internals: any;

  beforeEach(() => {
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        GeneLlmComponentComponent,
        { provide: PageTitleService, useValue: pageTitle }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    component = TestBed.inject(GeneLlmComponentComponent);
    internals = component as any;
  });

  afterEach(() => component.ngOnDestroy());

  it('sets the page title to Gene2Path', () => {
    expect(pageTitle.setTitle).toHaveBeenCalledWith('Gene2Path');
  });

  it('starts from a copy of the default configuration', () => {
    // Bound to the form, so it must not be the shared module-level default.
    expect(component.configuration.queryGene).toBeDefined();
    expect(component.showConfiguration).toBeFalse();
  });

  it('toggles the configuration panel', () => {
    component.changeShowConfiguration();
    expect(component.showConfiguration).toBeTrue();

    component.changeShowConfiguration();
    expect(component.showConfiguration).toBeFalse();
  });

  describe('resetting between queries', () => {
    it('clears every result field', () => {
      component.content = 'old content';
      component.details = [] as any;
      component.failure = 'old failure';
      component.annotated_pathway_content = 'old';
      component.annotated_pathway_details = 'old';
      component.pathway_2_ppi_abstracts_summary = 'old';
      component.ppiTableData = [] as any;

      internals.resetContent();

      expect(component.content).toBeUndefined();
      expect(component.details).toBeUndefined();
      expect(component.failure).toBeUndefined();
      expect(component.annotated_pathway_content).toBeUndefined();
      expect(component.annotated_pathway_details).toBeUndefined();
      expect(component.pathway_2_ppi_abstracts_summary).toBeUndefined();
      expect(component.ppiTableData).toBeUndefined();
    });

    it('empties the navigation sections in place, keeping the object bound to the menu', () => {
      const bound = component.navigationData;
      component.navigationData.ppiPathways.push('Signalling');
      component.navigationData.predPMIDPathways.push('Glycolysis');

      internals.resetContent();

      expect(component.navigationData).toBe(bound);
      expect(component.navigationData.ppiPathways).toEqual([]);
      expect(component.navigationData.predPMIDPathways).toEqual([]);
    });
  });

  describe('pathway name extraction', () => {
    it('pulls the first quoted pathway name out of the model output', () => {
      const text = 'PATHWAY_NAME:"Cell Cycle" and PATHWAY_NAME:"Glycolysis"';

      expect(internals.extractPathwayName(text)).toEqual('Cell Cycle');
    });

    it('returns undefined when the output names no pathway', () => {
      expect(internals.extractPathwayName('no pathway here')).toBeUndefined();
    });

    it('passes undefined text straight through', () => {
      expect(internals.extractPathwayName(undefined)).toBeUndefined();
    });
  });

  describe('PMID links', () => {
    it('turns a PMID citation into a PubMed link', () => {
      const linked = internals.addLinkToPMID('See PMID: 12345678 for detail.');

      expect(linked).toContain('https://pubmed.ncbi.nlm.nih.gov/12345678');
      expect(linked).toContain('PMID:12345678');
    });

    it('links every citation in the text', () => {
      const linked = internals.addLinkToPMID('PMID: 111 and PMID: 222');

      expect((linked.match(/pubmed\.ncbi\.nlm\.nih\.gov/g) ?? []).length).toEqual(2);
    });

    it('leaves text with no citation alone', () => {
      expect(internals.addLinkToPMID('nothing to link')).toEqual('nothing to link');
    });
  });

  describe('gene highlighting', () => {
    it('wraps the query gene so it stands out in the summary', () => {
      const hilited = internals.hiliteGene('TANC1 interacts with CDK1', 'TANC1');

      expect(hilited).toContain('<b class="query_gene">TANC1</b>');
    });

    it('strips the markdown emphasis the model emits rather than nesting it', () => {
      const hilited = internals.hiliteGene('**TANC1** interacts', 'TANC1');

      expect(hilited).toContain('<b class="query_gene">TANC1</b>');
      expect(hilited).not.toContain('**');
    });

    it('matches the gene case-insensitively', () => {
      const hilited = internals.hiliteGene('tanc1 interacts', 'TANC1');

      expect(hilited).toContain('<b class="query_gene">tanc1</b>');
    });

    it('highlights other emphasised phrases too', () => {
      const hilited = internals.hiliteGene('**strongly** binds', 'TANC1');

      expect(hilited).toContain('<b class="query_gene">strongly</b>');
    });
  });

  describe('pathway links', () => {
    const name2id = { 'Cell Cycle': 1640170 };

    it('links a pathway name in prose to the Pathway Browser', () => {
      const linked = internals.addPathwayLinks('Involved in Cell Cycle.', name2id, false);

      expect(linked).toContain('https://reactome.org/PathwayBrowser/#/1640170');
      expect(linked).toContain('>Cell Cycle</a>');
    });

    it('unwraps a bracketed pathway name before linking it', () => {
      const linked = internals.addPathwayLinks('Involved in [Cell Cycle].', name2id, false);

      expect(linked).toContain('>Cell Cycle</a>');
      expect(linked).not.toContain('[Cell Cycle]');
    });

    it('replaces the PATHWAY_NAME marker form when asked', () => {
      const linked = internals.addPathwayLinks('PATHWAY_NAME:"Cell Cycle"', name2id, true);

      expect(linked).toContain('PATHWAY: <a href=');
      expect(linked).not.toContain('PATHWAY_NAME:');
    });

    it('passes undefined text straight through', () => {
      expect(internals.addPathwayLinks(undefined, name2id, false)).toBeUndefined();
    });
  });

  it('converts newlines to line breaks for HTML display', () => {
    expect(internals.replaceNewLine('one\ntwo')).toEqual('one<br>two');
  });

  it('applies every text transformation in postProcessText', () => {
    const processed = internals.postProcessText(
      'TANC1 acts in Cell Cycle.\nSee PMID: 12345678',
      'TANC1',
      { 'Cell Cycle': 1640170 }
    );

    expect(processed).toContain('<br>');
    expect(processed).toContain('<b class="query_gene">TANC1</b>');
    expect(processed).toContain('reactome.org/PathwayBrowser');
    expect(processed).toContain('pubmed.ncbi.nlm.nih.gov');
  });

  describe('PPI abstract summaries', () => {
    it('pairs each interacting gene with its pipe-separated PMIDs', () => {
      const summaries = internals.mappingSummary(['CDK1', 'TP53'], ['111|222', '333']);

      expect(summaries).toEqual([
        { gene: 'CDK1', pmids: ['111', '222'] },
        { gene: 'TP53', pmids: ['333'] }
      ]);
    });

    it('yields nothing for no interacting genes', () => {
      expect(internals.mappingSummary([], [])).toEqual([]);
    });
  });

  it('keys the abstract scores by pmid and pathway', () => {
    const scores = internals.processPathwayAbstractScores([
      { pmid: '111', pathway: 'Cell Cycle', cos_score: 0.4, llm_score: 4, enrichment_fdr: 0.01 }
    ]);

    expect(scores['111:Cell Cycle']).toEqual([0.4, 4, 0.01]);
  });
});
