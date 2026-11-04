import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { CandidatePaper, GeneSearchResult } from 'src/app/paper-annotation/models/llm-api.models';
import { LlmApiError, LlmApiService } from 'src/app/paper-annotation/services/llm-api.service';

/**
 * The "Relevant Papers" section of Gene2Path: the papers worth annotating the query gene from (PubMed search,
 * re-rank, LLM judge in curator-tool-llm), listed under the pathways so the curator reads the pathways first. The
 * ticked papers start a Paper2Path annotation with the gene as its focus.
 *
 * This used to be a "Find papers for a gene" card on the Paper2Path start page. It moved here so a gene is looked at
 * one way, pathways then papers, rather than two.
 *
 * Gene2Path itself is unguarded (its URL is cited in grant applications), but curator-tool-llm needs a WebBench
 * token, so without one the section asks the curator to log in rather than failing with a 401.
 */
@Component({
  selector: 'app-gene-papers',
  templateUrl: './gene-papers.component.html',
  styleUrls: ['./gene-papers.component.scss'],
})
export class GenePapersComponent implements OnChanges, OnDestroy {
  /** The gene Gene2Path was run for. Each new object starts a new search, so running the same gene again does too. */
  @Input() query: GenePaperQuery | null = null;

  searching = false;
  progress = '';
  result: GeneSearchResult | null = null;
  error: string | null = null;
  /** PMIDs of the candidates ticked for "Annotate selected". */
  selectedPmids = new Set<string>();
  starting = false;
  /** The Paper2Path annotation started from the ticked papers, to open from here. */
  startedSessionId: string | null = null;

  private sub?: Subscription;

  constructor(private api: LlmApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['query']) this.search();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** The symbol as the service will use it: trimmed and upper-cased. */
  get geneSymbol(): string {
    return (this.query?.gene ?? '').trim().toUpperCase();
  }

  /** The service's rule for a gene symbol (letters, digits, '.' and '-'; HLA-A, C9orf72), so it is not sent a typo. */
  get geneValid(): boolean {
    return /^[A-Z0-9][A-Z0-9.-]{0,24}$/.test(this.geneSymbol);
  }

  get loggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  search(): void {
    this.reset();
    if (!this.geneSymbol || !this.geneValid || !this.loggedIn) return;
    const gene = this.geneSymbol;
    this.searching = true;
    this.progress = 'starting';
    this.sub = this.api.findPapersByGene(gene).subscribe({
      next: r => this.poll(r.jobId, gene),
      error: (e: LlmApiError) => { this.searching = false; this.error = e.message; }
    });
  }

  private poll(jobId: string, gene: string): void {
    this.sub = this.api.pollGeneSearch(jobId).subscribe({
      next: j => {
        this.progress = j.progress;
        if (j.status === 'done') {
          this.searching = false;
          this.result = j.result ?? { gene, accession: null, pool_size: 0, candidate_pool: 0, dropped_below_threshold: 0, papers: [] };
          // Tick what can be annotated straight away: in PMC, and not judged unannotatable.
          this.selectedPmids = new Set(this.result.papers.filter(p => this.canSelect(p) && p.annotatable !== false).map(p => p.pmid));
        } else if (j.status === 'failed') {
          this.searching = false;
          this.error = `The paper search for ${gene} failed: ${j.error ?? 'no reason given'}`;
        }
      },
      error: (e: LlmApiError) => { this.searching = false; this.error = e.message; }
    });
  }

  private reset(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.searching = false;
    this.progress = '';
    this.result = null;
    this.error = null;
    this.selectedPmids = new Set();
    this.starting = false;
    this.startedSessionId = null;
  }

  /** A paper without PMC full text can only be annotated from its PDF, which /sessions {pmids} cannot take. */
  canSelect(p: CandidatePaper): boolean {
    return !!p.pmcid;
  }

  toggleCandidate(p: CandidatePaper, on: boolean): void {
    if (on && this.canSelect(p)) this.selectedPmids.add(p.pmid);
    else this.selectedPmids.delete(p.pmid);
  }

  /** The ticked candidates, in the judge's order. */
  get selectedCandidates(): string[] {
    return (this.result?.papers ?? []).filter(p => this.selectedPmids.has(p.pmid)).map(p => p.pmid);
  }

  /**
   * Starts the annotation, then offers a link to it rather than navigating there: Gene2Path's results are not kept
   * anywhere, so leaving the page would lose them, and opening a tab once the call returns is no longer part of the
   * click, so a popup blocker would stop it.
   */
  annotateSelected(): void {
    const pmids = this.selectedCandidates;
    if (!this.result || !pmids.length || this.starting) return;
    this.starting = true;
    this.error = null;
    this.api.startPapers(pmids, [], this.result.gene).subscribe({
      next: r => { this.starting = false; this.startedSessionId = r.sessionId; },
      error: (e: LlmApiError) => { this.starting = false; this.error = e.message; }
    });
  }
}

export interface GenePaperQuery {
  gene: string;
}
