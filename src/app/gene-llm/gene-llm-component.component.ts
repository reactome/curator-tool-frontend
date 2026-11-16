import { Component, OnDestroy } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { GenePathwaysResult, PartnerEvidence, PathwayEvidence, PredictedPathway } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';
import { Configuration, DEFAULT_LLM_CONFIG } from "./components/configuration-component/configuration-component.component";
import { OutlineSection } from './components/navigation-menu/navigation-menu.component';

/** A piece of a pathway summary: plain text, or a citation to show as a PubMed link. */
export interface SummaryPart {
  text: string;
  pmid?: string;
}

/** Starting a Paper2Path annotation from one partner's papers, and how it went. */
export interface PartnerStart {
  starting: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Gene2Path: the Reactome pathways a gene is, or could be, annotated in, then the papers to annotate it from.
 *
 * The pathways come from curator-tool-llm's POST /api/llm/pathways/by-gene, predicted without an LLM: the released human
 * pathways the gene is already in, and those enriched among its top functional-interaction partners that it is not in
 * yet, each with an LLM summary of its literature (unless turned off in Settings) shown under the pathway's row, then
 * the PubMed papers that link the gene to it (opened under the summary). Each partner's papers carry an LLM check of
 * their abstract (does it describe a biochemical event between the two); the curator ticks some and annotates them in
 * Paper2Path as one session, placed in the predicted pathway. This page used to call a
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
  /** The partner papers ticked for annotation (PMIDs), by partnerKey. */
  partnerSelection = new Map<string, Set<string>>();
  /** The Paper2Path annotations started from a partner's papers, by partnerKey. */
  partnerStarts = new Map<string, PartnerStart>();

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
    this.partnerSelection.clear();
    this.partnerStarts.clear();
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
            // Tick what is worth annotating straight away: in PMC, and judged to describe a direct event.
            for (const pe of p.partner_evidence ?? []) {
              const ticked = pe.papers.filter(e => this.canAnnotate(e) && e.check?.relation === 'direct').map(e => e.pmid);
              this.partnerSelection.set(this.partnerKey(p, pe), new Set(ticked));
            }
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

  partnerKey(p: PredictedPathway, pe: PartnerEvidence): string {
    return `${p.pathway_id}|${pe.partner}`;
  }

  /** A paper without PMC full text can only be annotated from its PDF, which /sessions {pmids} cannot take. */
  canAnnotate(e: PathwayEvidence): boolean {
    return !!e.pmcid;
  }

  isPartnerPaperSelected(p: PredictedPathway, pe: PartnerEvidence, e: PathwayEvidence): boolean {
    return !!this.partnerSelection.get(this.partnerKey(p, pe))?.has(e.pmid);
  }

  togglePartnerPaper(p: PredictedPathway, pe: PartnerEvidence, e: PathwayEvidence, on: boolean): void {
    const key = this.partnerKey(p, pe);
    const chosen = this.partnerSelection.get(key) ?? new Set<string>();
    if (on && this.canAnnotate(e)) chosen.add(e.pmid);
    else chosen.delete(e.pmid);
    this.partnerSelection.set(key, chosen);
  }

  /** The ticked papers of one partner, in the order listed. */
  selectedPartnerPapers(p: PredictedPathway, pe: PartnerEvidence): string[] {
    const chosen = this.partnerSelection.get(this.partnerKey(p, pe));
    return chosen ? pe.papers.filter(e => chosen.has(e.pmid)).map(e => e.pmid) : [];
  }

  /**
   * Annotates the ticked papers of one partner in Paper2Path as ONE session (merged), focused on the gene and placed
   * in this pathway, then offers a link to it rather than navigating there: leaving the page would lose the results,
   * and opening a tab once the call returns is no longer part of the click, so a popup blocker would stop it.
   */
  annotatePartner(p: PredictedPathway, pe: PartnerEvidence): void {
    const key = this.partnerKey(p, pe);
    const pmids = this.selectedPartnerPapers(p, pe);
    if (!this.result || !pmids.length || this.partnerStarts.get(key)?.starting) return;
    this.partnerStarts.set(key, { starting: true });
    this.api.startPartnerPapers(pmids, this.result.gene, pe.partner, p.pathway_id).subscribe({
      next: r => this.partnerStarts.set(key, { starting: false, sessionId: r.sessionId }),
      error: (e: LlmApiError) => this.partnerStarts.set(key, { starting: false, error: e.message })
    });
  }

  /** What the relation chip's tooltip says. */
  relationTooltip(e: PathwayEvidence): string {
    const what = { direct: 'describes a molecular event between the two', indirect: 'links the two, with no mechanism given',
                   none: 'only mentions the two together' }[e.check!.relation];
    return `An LLM read the abstract: it ${what}. Check the paper before relying on it.`;
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
