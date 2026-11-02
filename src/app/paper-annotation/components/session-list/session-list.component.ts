import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, filter, of, switchMap, takeUntil, timer } from 'rxjs';
import { SessionSummary, StartResponse } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

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
  starting = false;

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
    this.files.splice(index, 1);
  }

  start(): void {
    if (!this.canStart) return;
    this.begin(this.api.startPapers(this.pmidList, this.files, this.focus.trim() || undefined));
  }

  private begin(call: import('rxjs').Observable<StartResponse>): void {
    this.starting = true;
    this.error = null;
    call.subscribe({
      next: r => this.router.navigate([r.sessionId], { relativeTo: this.route }),
      error: (e: LlmApiError) => { this.starting = false; this.error = e.message; },
      complete: () => this.starting = false
    });
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
