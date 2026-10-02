import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, switchMap, takeWhile, throwError, timer, catchError, map } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { TokenRefreshService } from 'src/app/core/services/token-refresh.service';
import {
  AcceptResponse, ChatEvent, ExistingMatch, InstanceEvidence, Issue, IssueStatus, Job, Passage, Proposal,
  ProposalRequest, QAResult, ReactionDetail, SessionDetail, SessionSummary, SessionUserInstances, StartResponse, StoredChatMessage
} from '../models/llm-api.models';
import { parseSse } from './sse-parser';

/** A failed call to the annotation service, with a message that is safe to show to the curator. */
export class LlmApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'LlmApiError';
  }
}

function detailOf(body: any): string | null {
  const d = body?.detail;
  if (!d) return null;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(x => x?.msg ?? JSON.stringify(x)).join('; ');
  return JSON.stringify(d);
}

export function toApiError(e: unknown): LlmApiError {
  if (e instanceof LlmApiError) return e;
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return new LlmApiError(0, 'The annotation service is not reachable. Is curator-tool-llm running?');
    const detail = detailOf(e.error);
    if (e.status === 401) return new LlmApiError(401, detail ?? 'You are not signed in to the annotation service.');
    if (e.status === 403) return new LlmApiError(403, detail ?? 'Your account may not use the annotation service (curator role required).');
    return new LlmApiError(e.status, detail ?? `The annotation service returned ${e.status}.`);
  }
  return new LlmApiError(0, e instanceof Error ? e.message : String(e));
}

/**
 * Client for the curator-tool-llm REST API. The HeaderInterceptor adds the bearer token to these calls
 * (see isLlmRequest there). A 401 gets ONE token refresh and retry here; anything still failing is reported,
 * never turned into a logout: the service is a separate system and being unreachable or refusing a token
 * says nothing about the curator's own session.
 */
@Injectable({ providedIn: 'root' })
export class LlmApiService {
  private readonly base = environment.llmApiURL;

  constructor(private http: HttpClient, private tokenRefresh: TokenRefreshService) {}

  // ── plumbing ───────────────────────────────────────────────────────────
  private call<T>(request: () => Observable<T>): Observable<T> {
    return request().pipe(
      catchError(err => err instanceof HttpErrorResponse && err.status === 401
        ? this.tokenRefresh.refresh().pipe(
            catchError(() => throwError(() => err)),
            switchMap(() => request()))
        : throwError(() => err)),
      catchError(err => throwError(() => toApiError(err))));
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  // ── sessions ───────────────────────────────────────────────────────────
  start(pmid: string, focus?: string): Observable<StartResponse> {
    return this.call(() => this.http.post<StartResponse>(this.url('/sessions'), { pmid, focus: focus || null }));
  }

  upload(file: File, focus?: string): Observable<StartResponse> {
    return this.call(() => {
      const form = new FormData();
      form.append('file', file, file.name);
      if (focus) form.append('focus', focus);
      return this.http.post<StartResponse>(this.url('/sessions/upload'), form);
    });
  }

  sessions(): Observable<SessionSummary[]> {
    return this.call(() => this.http.get<SessionSummary[]>(this.url('/sessions')));
  }

  session(id: string): Observable<SessionDetail> {
    return this.call(() => this.http.get<SessionDetail>(this.url(`/sessions/${id}`)));
  }

  job(id: string): Observable<Job> {
    return this.call(() => this.http.get<Job>(this.url(`/jobs/${id}`)));
  }

  /** Emits each job state until it is done or failed (the final state is emitted too, then it completes). */
  pollJob(id: string, everyMs = 3000): Observable<Job> {
    return timer(0, everyMs).pipe(
      switchMap(() => this.job(id)),
      takeWhile(j => j.status !== 'done' && j.status !== 'failed', true));
  }

  // ── review material ────────────────────────────────────────────────────
  issues(id: string, status?: IssueStatus): Observable<Issue[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.call(() => this.http.get<Issue[]>(this.url(`/sessions/${id}/issues`), { params }));
  }

  setIssueStatus(id: string, issueId: string, status: IssueStatus): Observable<Issue> {
    return this.call(() => this.http.patch<Issue>(this.url(`/sessions/${id}/issues/${issueId}`), { status }));
  }

  reaction(id: string, key: string): Observable<ReactionDetail> {
    return this.call(() => this.http.get<ReactionDetail>(this.url(`/sessions/${id}/reactions/${key}`)));
  }

  instanceEvidence(id: string, dbId: number): Observable<InstanceEvidence[]> {
    return this.call(() => this.http.get<InstanceEvidence[]>(this.url(`/sessions/${id}/instances/${dbId}/evidence`)));
  }

  exportInstances(id: string): Observable<SessionUserInstances> {
    return this.call(() => this.http.get<SessionUserInstances>(this.url(`/sessions/${id}/export`)));
  }

  searchPaper(id: string, q: string, section?: string, limit = 5): Observable<Passage[]> {
    let params = new HttpParams().set('q', q).set('limit', limit);
    if (section) params = params.set('section', section);
    return this.call(() => this.http.get<Passage[]>(this.url(`/sessions/${id}/paper/search`), { params }));
  }

  existing(id: string): Observable<ExistingMatch[]> {
    return this.call(() => this.http.get<ExistingMatch[]>(this.url(`/sessions/${id}/existing`)));
  }

  checkExisting(id: string): Observable<ExistingMatch[]> {
    return this.call(() => this.http.post<ExistingMatch[]>(this.url(`/sessions/${id}/existing/check`), {}));
  }

  qa(id: string, reactionKey: string, llm = true): Observable<QAResult> {
    const params = new HttpParams().set('llm', llm);
    return this.call(() => this.http.post<QAResult>(this.url(`/sessions/${id}/qa/${reactionKey}`), {}, { params }));
  }

  // ── edits ──────────────────────────────────────────────────────────────
  proposals(id: string, status?: Proposal['status']): Observable<Proposal[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.call(() => this.http.get<Proposal[]>(this.url(`/sessions/${id}/proposals`), { params }));
  }

  propose(id: string, body: ProposalRequest): Observable<Proposal> {
    return this.call(() => this.http.post<Proposal>(this.url(`/sessions/${id}/proposals`), body));
  }

  accept(id: string, proposalId: string): Observable<AcceptResponse> {
    return this.call(() => this.http.post<AcceptResponse>(this.url(`/sessions/${id}/proposals/${proposalId}/accept`), {}));
  }

  reject(id: string, proposalId: string): Observable<Proposal> {
    return this.call(() => this.http.post<Proposal>(this.url(`/sessions/${id}/proposals/${proposalId}/reject`), {}));
  }

  // ── chat ───────────────────────────────────────────────────────────────
  chatHistory(id: string): Observable<StoredChatMessage[]> {
    return this.call(() => this.http.get<StoredChatMessage[]>(this.url(`/sessions/${id}/chat`)));
  }

  /**
   * Streams one chat turn. Read with fetch because EventSource cannot send the Authorization header.
   * Unsubscribing aborts the request. The observable errors with an LlmApiError if the request itself
   * fails; problems inside the turn arrive as an 'error' event followed by 'done'.
   */
  streamChat(id: string, message: string, selectedDbIds: number[] = []): Observable<ChatEvent> {
    return new Observable<ChatEvent>(subscriber => {
      const controller = new AbortController();
      const post = () => fetch(this.url(`/sessions/${id}/chat`), {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}` },
        body: JSON.stringify({ message, selectedDbIds })
      });
      (async () => {
        try {
          let res = await post();
          if (res.status === 401) {
            await firstValueFrom(this.tokenRefresh.refresh());
            res = await post();
          }
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw toApiError(new HttpErrorResponse({ status: res.status, error: body }));
          }
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = parseSse(buffer);
            buffer = parsed.rest;
            parsed.events.forEach(e => subscriber.next(e));
          }
          buffer += decoder.decode();
          if (buffer.trim()) parseSse(buffer + '\n\n').events.forEach(e => subscriber.next(e));
          subscriber.complete();
        } catch (e) {
          if ((e as { name?: string })?.name === 'AbortError') return;
          subscriber.error(e instanceof TypeError ? new LlmApiError(0, 'The annotation service is not reachable. Is curator-tool-llm running?') : toApiError(e));
        }
      })();
      return () => controller.abort();
    });
  }
}
