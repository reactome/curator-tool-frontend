import { Component, OnDestroy } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { GenePathwaysResult } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { Configuration, DEFAULT_LLM_CONFIG } from "./components/configuration-component/configuration-component.component";
import { GenePaperQuery } from './components/gene-papers/gene-papers.component';
import { OutlineSection } from './components/navigation-menu/navigation-menu.component';

/**
 * Gene2Path: the Reactome pathways a gene is, or could be, annotated in, then the papers to annotate it from.
 *
 * The pathways come from curator-tool-llm's POST /api/llm/pathways/by-gene, without an LLM: the released human pathways
 * the gene is already in, and those enriched among its top functional-interaction partners. This page used to call a
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
  /** Drives the Relevant Papers section, listed under the pathways. A new object per run starts a new paper search. */
  paperQuery: GenePaperQuery | null = null;

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
    // The paper search is a separate, slow job (a minute or two). Start it now, alongside the pathway search, so the
    // papers are usually ready by the time the curator has read the pathways above them.
    this.paperQuery = { gene };
    this.sub = this.api.findPathwaysByGene(gene, { ...this.configuration }).pipe(
      switchMap(r => this.api.pollPathwaySearch(r.jobId))
    ).subscribe({
      next: j => {
        this.progress = j.progress;
        if (j.status === 'done') {
          this.searching = false;
          this.result = j.result ?? null;
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
    if (this.paperQuery) s.push({ id: 'relevant_papers', label: 'Relevant Papers' });
    return s;
  }

  get newPredictions(): number {
    return (this.result?.predicted_pathways ?? []).filter(p => !p.annotated).length;
  }

  pathwayUrl(dbId: number): string {
    return `https://reactome.org/PathwayBrowser/#/${dbId}`;
  }

  /** 1.2E-4, as the FDR was shown before. */
  formatFdr(fdr: number): string {
    return fdr.toExponential(1).toUpperCase();
  }
}
