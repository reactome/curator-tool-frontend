import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

export interface AnnotationJobStatus {
  job_id: string;
  status: 'running' | 'done' | 'error' | 'not_found';
  gene?: string;
  result?: any;
  error?: string;
}

export interface AnnotationRequest {
  pmids: string[];
  numberOfPubmed?: number;
  qualityThreshold?: number;
  enableFullText?: boolean;
  enableLiteratureSearch?: boolean;
  queryGene?: string;
  enabledPhases?: string[];
  enabledAgents?: string[];
  enabledTools?: Record<string, string[]>;
}

export interface CrewAIDashboardPhase {
  id: string;
  label: string;
  description?: string;
}

export interface CrewAIDashboardAgent {
  id: string;
  label: string;
  phases: string[];
}

export interface CrewAIDashboardTool {
  id: string;
  label: string;
}

export interface CrewAIDashboardConfig {
  phases: CrewAIDashboardPhase[];
  agents: CrewAIDashboardAgent[];
  toolsByAgent: Record<string, CrewAIDashboardTool[]>;
}

export interface CrewAILogEntry {
  seq: number;
  ts: string;
  event_type?: string;
  status?: string;
  agent?: string;
  tool?: string;
  phase?: string;
  gene?: string;
  outcome?: string;
  error?: string;
  level?: string;
  logger?: string;
  message?: string;
  [key: string]: any;
}

export interface CrewAILogResponse {
  status: string;
  gene?: string;
  logs: CrewAILogEntry[];
  next_since: number;
}

export interface CrewAISystemStatus {
  status: string;
  model: string;
  temperature: number;
  max_iterations: number;
  agents: string[];
  jobs: {
    running: number;
    done: number;
    error: number;
  };
}

export interface PreloadedPaper {
  pmid: string;
  exists: boolean;
  sizeBytes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class Paper2pathService {
  private LLM_HOST = environment.llmURL;
  private MOCK_RESULT_URL = 'assets/paper2path/tanc1_3973163_crewai_result.json';
  private CREWAI_ANNOTATE_URL = `${this.LLM_HOST}/crewai/annotate`;
  private CREWAI_RESULT_URL = `${this.LLM_HOST}/crewai/result`;
  private CREWAI_LOGS_URL = `${this.LLM_HOST}/crewai/logs`;
  private CREWAI_DASHBOARD_URL = `${this.LLM_HOST}/crewai/dashboard`;
  private CREWAI_STATUS_URL = `${this.LLM_HOST}/crewai/status`;
  private FULLTEXT_UPLOAD_URL = `${this.LLM_HOST}/fulltext/uploadPDF`;
  private FULLTEXT_CHECK_URL = `${this.LLM_HOST}/fulltext/check_pdf`;
  private FULLTEXT_LIST_URL = `${this.LLM_HOST}/fulltext/list`;

  constructor(private http: HttpClient) {}

  private extractServerErrorMessage(payload: any): string | undefined {
    if (!payload) return undefined;

    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (!trimmed) return undefined;
      try {
        return this.extractServerErrorMessage(JSON.parse(trimmed)) || trimmed;
      } catch {
        return trimmed;
      }
    }

    if (Array.isArray(payload)) {
      const messages = payload
        .map((item) => this.extractServerErrorMessage(item))
        .filter((msg): msg is string => !!msg);
      return messages.length ? messages.join('; ') : undefined;
    }

    if (typeof payload === 'object') {
      const direct = payload.message || payload.error || payload.detail || payload.reason;
      if (typeof direct === 'string' && direct.trim()) {
        return direct.trim();
      }
      if (typeof payload.error === 'object') {
        const nested = this.extractServerErrorMessage(payload.error);
        if (nested) return nested;
      }
      if (typeof payload.errors === 'object') {
        const nested = this.extractServerErrorMessage(payload.errors);
        if (nested) return nested;
      }
    }

    return undefined;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;
    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    } else {
      message = this.extractServerErrorMessage(error.error)
        || error.message
        || `HTTP ${error.status}: ${error.statusText}`;
    }
    return throwError(() => new Error(message));
  }

  submitAnnotation(request: AnnotationRequest): Observable<AnnotationJobStatus> {
    const payload = {
      pmids: request.pmids,
      numberOfPubmed: request.numberOfPubmed || 8,
      qualityThreshold: request.qualityThreshold || 0.7,
      enableFullText: request.enableFullText ?? true,
      enableLiteratureSearch: request.enableLiteratureSearch ?? false,
      ...(request.queryGene && { queryGene: request.queryGene }),
      ...(request.enabledPhases && { enabledPhases: request.enabledPhases }),
      ...(request.enabledAgents && { enabledAgents: request.enabledAgents }),
      ...(request.enabledTools && { enabledTools: request.enabledTools })
    };
    return this.http.post<AnnotationJobStatus>(this.CREWAI_ANNOTATE_URL, payload).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getJobStatus(jobId: string): Observable<AnnotationJobStatus> {
    return this.http.get<AnnotationJobStatus>(`${this.CREWAI_RESULT_URL}/${jobId}`).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getJobLogs(jobId: string, since = 0, limit = 200): Observable<CrewAILogResponse> {
    return this.http.get<CrewAILogResponse>(`${this.CREWAI_LOGS_URL}/${jobId}?since=${since}&limit=${limit}`).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getDashboardConfig(): Observable<CrewAIDashboardConfig> {
    return this.http.get<CrewAIDashboardConfig>(this.CREWAI_DASHBOARD_URL).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getPreloadedPapers(): Observable<PreloadedPaper[]> {
    return this.http.get<{ papers: { pmid: string; exists: boolean; size_bytes?: number }[] }>(this.FULLTEXT_LIST_URL).pipe(
      map(resp => resp.papers.map(p => ({ pmid: p.pmid, exists: p.exists, sizeBytes: p.size_bytes }))),
      catchError(err => this.handleError(err))
    );
  }

  getMockAnnotationResult(): Observable<any> {
    return this.http.get<any>(this.MOCK_RESULT_URL).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getSystemStatus(): Observable<CrewAISystemStatus> {
    return this.http.get<CrewAISystemStatus>(this.CREWAI_STATUS_URL).pipe(
      catchError(err => this.handleError(err))
    );
  }

  uploadPaper(file: File, pmid: string): Observable<{ status: string }> {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('pmid', pmid);
    return this.http.post<{ status: string }>(this.FULLTEXT_UPLOAD_URL, formData).pipe(
      catchError(err => this.handleError(err))
    );
  }

  checkPaperExists(pmid: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.FULLTEXT_CHECK_URL}/${pmid}`).pipe(
      catchError(() => [false])
    );
  }

  isValidPmid(pmid: string): boolean {
    return /^\d{1,8}$/.test(pmid.trim());
  }

  extractPmidsFromText(text: string): string[] {
    const pmidRegex = /\b\d{1,8}\b/g;
    const matches = text.match(pmidRegex);
    return matches ? matches.filter(pmid => this.isValidPmid(pmid)) : [];
  }
}