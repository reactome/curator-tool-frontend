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

  pmid = '';
  pmidFocus = '';
  pdfFocus = '';
  file: File | null = null;
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

  get pmidValid(): boolean {
    return /^\d{1,9}$/.test(this.pmid.trim());
  }

  startFromPmid(): void {
    if (!this.pmidValid || this.starting) return;
    this.begin(this.api.start(this.pmid.trim(), this.pmidFocus.trim() || undefined));
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files && input.files.length ? input.files[0] : null;
  }

  startFromPdf(): void {
    if (!this.file || this.starting) return;
    this.begin(this.api.upload(this.file, this.pdfFocus.trim() || undefined));
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

  label(s: SessionSummary): string {
    return s.pmid ? `PMID ${s.pmid}` : s.source;
  }
}
