import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

export interface NLQueryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface NLQueryStep {
  cypher: string;
  params: Record<string, unknown>;
  ok: boolean;
  row_count?: number | null;
  error?: string | null;
}

export interface NLQueryResponse {
  answer: string;
  queries: NLQueryStep[];
  columns: string[];
  rows: Record<string, unknown>[];
  rows_truncated: boolean;
  model: string | null;
}

/**
 * Client for the read-only natural-language graph query sidecar (neo4jmcp on the curator server):
 * it turns a question into Cypher with Claude and runs it through mcp-neo4j-cypher.
 * HeaderInterceptor attaches the curator's JWT and handles 401 token refresh for this URL.
 */
@Injectable({ providedIn: 'root' })
export class NLQueryService {
  private http = inject(HttpClient);
  private url = environment.nlQueryURL;

  ask(question: string, history: NLQueryTurn[] = []): Observable<NLQueryResponse> {
    return this.http.post<NLQueryResponse>(this.url, { question, history });
  }
}
