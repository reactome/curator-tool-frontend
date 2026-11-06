import { Component, OnDestroy } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { GenePathwaysResult } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { Configuration, DEFAULT_LLM_CONFIG } from "./components/configuration-component/configuration-component.component";
import { OutlineSection } from './components/navigation-menu/navigation-menu.component';

/** A piece of a pathway summary: plain text, or a citation to show as a PubMed link. */
export interface SummaryPart {
  text: string;
  pmid?: string;
}

/**
 * Gene2Path: the Reactome pathways a gene is, or could be, annotated in, then the papers to annotate it from.
 *
 * The pathways come from curator-tool-llm's POST /api/llm/pathways/by-gene, predicted without an LLM: the released human
 * pathways the gene is already in, and those enriched among its top functional-interaction partners that it is not in
 * yet, each with an LLM summary of its literature (unless turned off in Settings) shown under the pathway's row, then
 * the PubMed papers that link the gene to it (opened under the summary). This page used to call a
 * Flask service (environment.llmURL, POST /annotate) that wrote LLM summaries of both; that service was deleted from
 * curator-tool-llm, and in production /llm/ is the new service, so the page had stopped working at all.
 *
 * The route stays unguarded (its URL is cited in grant applications), but the service needs a WebBench token, so
 * without one the page asks the curator to log in instead of running.
 */
@Component({
  selector: 'app-gene-llm-component',
  templateUrl: './gene-llm-component.component.html',
  styleUrls: ['./gene-llm-component.component.scss'],
})
export class GeneLlmComponentComponent implements OnDestroy {
  gene: string = "NTN1";
  configuration: Configuration = { ...DEFAULT_LLM_CONFIG };
  showConfiguration: boolean = false;

  /** Set once a gene has been submitted: the intro gives way to the results. */
  hasRun = false;
  searching = false;
  progress = '';
  failure: string | null = null;
  result: GenePathwaysResult | null = null;
  /** The predicted pathways (dbIds) whose literature is open. */
  openEvidence = new Set<number>();
  /**
   * Each predicted pathway's summary (by dbId), split once into text and citations when the result arrives. Splitting
   * in the template would build new arrays on every change detection, and *ngFor would re-create the links each time.
   */
  summaries = new Map<number, SummaryPart[]>();

  private sub?: Subscription;

  constructor(private api: LlmApiService, pageTitleService: PageTitleService) {
    pageTitleService.setTitle('Gene2Path');
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get loggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  changeShowConfiguration() {
    this.showConfiguration = !this.showConfiguration;
  }

  run(): void {
    const gene = this.gene.trim().toUpperCase();
    if (!gene || this.searching || !this.loggedIn) return;
    this.gene = gene;
    this.sub?.unsubscribe();
    this.hasRun = true;
    this.showConfiguration = false;
    this.searching = true;
    this.progress = 'starting';
    this.failure = null;
    this.result = null;
    this.openEvidence.clear();
    this.summaries.clear();
    this.sub = this.api.findPathwaysByGene(gene, { ...this.configuration }).pipe(
      switchMap(r => this.api.pollPathwaySearch(r.jobId))
    ).subscribe({
      next: j => {
        this.progress = j.progress;
        if (j.status === 'done') {
          this.searching = false;
          this.result = j.result ?? null;
          for (const p of this.result?.predicted_pathways ?? []) {
            if (p.summary) this.summaries.set(p.pathway_id, splitCitations(p.summary));
          }
          if (!this.result) this.failure = `The pathway search for ${gene} returned nothing.`;
        } else if (j.status === 'failed') {
          this.searching = false;
          this.failure = `The pathway search for ${gene} failed: ${j.error ?? 'no reason given'}`;
        }
      },
      error: (e: LlmApiError) => { this.searching = false; this.failure = e.message; }
    });
  }

  /** The outline: one entry per section on the page. */
  get sections(): OutlineSection[] {
    const s: OutlineSection[] = [];
    if (this.result) {
      s.push({ id: 'annotated_pathways', label: 'Annotated Pathways' },
             { id: 'predicted_pathways', label: 'Predicted Pathways' });
      if (this.result.partners.length) s.push({ id: 'fi_partners', label: 'Interaction Partners', level: 1 });
    }
    return s;
  }

  get newPredictions(): number {
    return (this.result?.predicted_pathways ?? []).filter(p => !p.annotated).length;
  }

  toggleEvidence(dbId: number): void {
    if (!this.openEvidence.delete(dbId)) this.openEvidence.add(dbId);
  }

  pubmedUrl(pmid: string): string {
    return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  }

  pmcUrl(pmcid: string): string {
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`;
  }

  pathwayUrl(dbId: number): string {
    return `https://reactome.org/PathwayBrowser/#/${dbId}`;
  }

  get summarizing(): boolean {
    return this.configuration.summarize && this.configuration.max_evidence > 0;
  }

  /** 1.2E-4, as the FDR was shown before. */
  formatFdr(fdr: number): string {
    return fdr.toExponential(1).toUpperCase();
  }
}

/** "PINK1 binds RHOT1 [PMID:1]." -> [{text: 'PINK1 binds RHOT1 '}, {text: 'PMID 1', pmid: '1'}, {text: '.'}] */
export function splitCitations(summary: string): SummaryPart[] {
  const parts: SummaryPart[] = [];
  let last = 0;
  for (const m of summary.matchAll(/\[PMID:\s*(\d+)\]/g)) {
    if (m.index! > last) parts.push({ text: summary.slice(last, m.index) });
    parts.push({ text: `PMID ${m[1]}`, pmid: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < summary.length) parts.push({ text: summary.slice(last) });
  return parts;
}
