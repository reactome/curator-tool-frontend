import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, filter, of, switchMap, takeUntil, tap, timer } from 'rxjs';
import { CandidatePaper, GeneSearchResult, SessionSummary, StartResponse } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

/** sessionStorage key for the gene search this tab is running or showing: { jobId, gene }. */
const GENE_SEARCH_KEY = 'paper2path.geneSearch';

@Component({
  selector: 'app-session-list',
  templateUrl: './session-list.component.html',
  styleUrls: ['./session-list.component.scss']
})
export class SessionListComponent implements OnInit, OnDestroy {
  sessions: SessionSummary[] = [];
  loading = true;
  error: string | null = null;

  /** The PubMed IDs as typed: one or more, separated by spaces, commas, semicolons or new lines. */
  pmids = '';
  focus = '';
  files: File[] = [];
  /** The PDFs ticked as review articles: they keep the reactions they only cite (research keeps only its own results). */
  reviews = new Set<File>();
  starting = false;

  /** Gene -> papers: the symbol as typed, then the running search, then its candidates to pick from. */
  gene = '';
  geneSearching = false;
  geneProgress = '';
  geneResult: GeneSearchResult | null = null;
  /** PMIDs of the candidates ticked for "Annotate selected". */
  selectedPmids = new Set<string>();
  private geneSub?: Subscription;

  private destroy$ = new Subject<void>();

  constructor(private api: LlmApiService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // One load on entry, then keep refreshing only while something is still being annotated.
    timer(0, 5000).pipe(
      filter(i => i === 0 || this.hasActive),
      switchMap(() => this.api.sessions().pipe(catchError((e: LlmApiError) => { this.error = e.message; return of(null); }))),
      takeUntil(this.destroy$)
    ).subscribe(list => {
      this.loading = false;
      if (list) { this.sessions = list; this.error = null; }
    });
    // A gene search takes a minute or more and runs on the server whatever this page does. If the curator left the
    // page while it ran (or after it finished, without starting an annotation), pick its job up again rather than
    // making them search, and wait, a second time. Per tab: sessionStorage.
    const saved = sessionStorage.getItem(GENE_SEARCH_KEY);
    if (saved) {
      try {
        const { jobId, gene } = JSON.parse(saved);
        this.gene = gene;
        this.pollGene(jobId);
      } catch {
        sessionStorage.removeItem(GENE_SEARCH_KEY);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasActive(): boolean {
    return this.sessions.some(s => s.status === 'queued' || s.status === 'running');
  }

  /** The PubMed IDs typed, without repeats. */
  get pmidList(): string[] {
    return [...new Set(this.pmids.split(/[\s,;]+/).filter(t => t))];
  }

  get pmidsValid(): boolean {
    return this.pmidList.every(t => /^\d{1,9}$/.test(t));
  }

  get paperCount(): number {
    return this.pmidList.length + this.files.length;
  }

  get canStart(): boolean {
    return this.paperCount > 0 && this.pmidsValid && !this.starting;
  }

  /** "2 PDFs + 1 PubMed ID" */
  get summary(): string {
    const parts: string[] = [];
    if (this.files.length) parts.push(`${this.files.length} PDF${this.files.length > 1 ? 's' : ''}`);
    if (this.pmidList.length) parts.push(`${this.pmidList.length} PubMed ID${this.pmidList.length > 1 ? 's' : ''}`);
    return parts.join(' + ');
  }

  /** Adds to the PDFs already chosen (the same file twice is kept once) and clears the picker so it can be used again. */
  onFilesChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    for (const f of Array.from(input.files ?? [])) {
      if (!this.files.some(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) this.files.push(f);
    }
    input.value = '';
  }

  removeFile(index: number): void {
    const [gone] = this.files.splice(index, 1);
    this.reviews.delete(gone);
  }

  setReview(file: File, review: boolean): void {
    if (review) this.reviews.add(file); else this.reviews.delete(file);
  }

  start(): void {
    if (!this.canStart) return;
    this.begin(this.api.startPapers(this.pmidList, this.files, this.focus.trim() || undefined, this.files.filter(f => this.reviews.has(f))));
  }

  private begin(call: Observable<StartResponse>): void {
    this.starting = true;
    this.error = null;
    call.subscribe({
      next: r => this.router.navigate([r.sessionId], { relativeTo: this.route }),
      error: (e: LlmApiError) => { this.starting = false; this.error = e.message; },
      complete: () => this.starting = false
    });
  }

  // ── gene -> papers ─────────────────────────────────────────────────────
  /** The symbol as the service will use it: trimmed and upper-cased. */
  get geneSymbol(): string {
    return this.gene.trim().toUpperCase();
  }

  /** The service's rule for a gene symbol (letters, digits, '.' and '-'; HLA-A, C9orf72), so a typo is caught here. */
  get geneValid(): boolean {
    return !this.geneSymbol || /^[A-Z0-9][A-Z0-9.-]{0,24}$/.test(this.geneSymbol);
  }

  get canSearchGene(): boolean {
    return !!this.geneSymbol && this.geneValid && !this.geneSearching;
  }

  searchGene(): void {
    if (!this.canSearchGene) return;
    this.clearGeneSearch();
    this.geneSearching = true;
    this.geneProgress = 'starting';
    this.error = null;
    const gene = this.geneSymbol;
    this.api.findPapersByGene(gene).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        sessionStorage.setItem(GENE_SEARCH_KEY, JSON.stringify({ jobId: r.jobId, gene }));
        this.pollGene(r.jobId);
      },
      error: (e: LlmApiError) => { this.geneSearching = false; this.error = e.message; }
    });
  }

  private pollGene(jobId: string): void {
    this.geneSearching = true;
    this.geneSub = this.api.pollGeneSearch(jobId).pipe(takeUntil(this.destroy$)).subscribe({
      next: j => {
        this.geneProgress = j.progress;
        if (j.status === 'done') {
          this.geneSearching = false;
          this.geneResult = j.result ?? { gene: this.geneSymbol, accession: null, pool_size: 0, candidate_pool: 0, dropped_below_threshold: 0, papers: [] };
          // Tick what can be annotated straight away: in PMC, and not judged unannotatable.
          this.selectedPmids = new Set(this.geneResult.papers.filter(p => this.canSelect(p) && p.annotatable !== false).map(p => p.pmid));
        } else if (j.status === 'failed') {
          this.geneSearching = false;
          sessionStorage.removeItem(GENE_SEARCH_KEY);
          this.error = `The paper search for ${this.geneSymbol} failed: ${j.error ?? 'no reason given'}`;
        }
      },
      error: (e: LlmApiError) => {
        // e.g. the job is gone because the service restarted: forget it, so coming back does not fail the same way
        this.geneSearching = false;
        sessionStorage.removeItem(GENE_SEARCH_KEY);
        this.error = e.message;
      }
    });
  }

  /** Stops waiting for a search (the service still finishes it) or puts its results away. */
  clearGeneSearch(): void {
    this.geneSub?.unsubscribe();
    this.geneSub = undefined;
    sessionStorage.removeItem(GENE_SEARCH_KEY);
    this.geneSearching = false;
    this.geneProgress = '';
    this.geneResult = null;
    this.selectedPmids = new Set();
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
    return (this.geneResult?.papers ?? []).filter(p => this.selectedPmids.has(p.pmid)).map(p => p.pmid);
  }

  annotateSelected(): void {
    const pmids = this.selectedCandidates;
    if (!this.geneResult || !pmids.length || this.starting) return;
    this.begin(this.api.startPapers(pmids, [], this.geneResult.gene).pipe(
      tap(() => sessionStorage.removeItem(GENE_SEARCH_KEY))));
  }

  open(s: SessionSummary): void {
    this.router.navigate([s.id], { relativeTo: this.route });
  }

  /** One paper: its PMID or file name. Several: the service's summary of them ("3 papers: a.pdf, b.pdf, ..."). */
  label(s: SessionSummary): string {
    if ((s.n_papers ?? 1) > 1) return s.source;
    return s.pmid ? `PMID ${s.pmid}` : s.source;
  }
}
