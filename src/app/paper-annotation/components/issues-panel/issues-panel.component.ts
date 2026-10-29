import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Issue, IssueSeverity, IssueStatus, QA_PRIORITY_LABEL, QAPriority, QAResult } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

const RANK: Record<IssueSeverity, number> = { action: 0, warning: 1, info: 2 };

@Component({
  selector: 'app-issues-panel',
  templateUrl: './issues-panel.component.html',
  styleUrls: ['./issues-panel.component.scss']
})
export class IssuesPanelComponent {
  @Input({ required: true }) sessionId!: string;
  @Input() issues: Issue[] = [];
  @Output() changed = new EventEmitter<Issue>();
  @Output() openReaction = new EventEmitter<string>();
  /** Emitted after checking every reaction, so the session's issues are re-read. */
  @Output() checked = new EventEmitter<void>();

  status: IssueStatus | 'all' = 'open';
  severity: IssueSeverity | 'all' = 'all';
  busy = new Set<string>();
  error: string | null = null;
  checking = false;
  /** The last "check all reactions" result, most urgent first. */
  ranking: QAResult[] = [];

  get shown(): Issue[] {
    return this.issues
      .filter(i => (this.status === 'all' || i.status === this.status) && (this.severity === 'all' || i.severity === this.severity))
      .sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.reaction_key ?? '').localeCompare(b.reaction_key ?? ''));
  }

  count(severity: IssueSeverity): number {
    return this.issues.filter(i => i.status === 'open' && i.severity === severity).length;
  }

  priorityLabel(p: QAPriority | undefined): string {
    return p ? QA_PRIORITY_LABEL[p] : '';
  }

  countPriority(p: QAPriority): number {
    return this.ranking.filter(r => r.priority === p).length;
  }

  /** Review every reaction (they run together on the service), then show them ranked. */
  checkAll(): void {
    this.checking = true;
    this.error = null;
    this.api.qaAll(this.sessionId).subscribe({
      next: results => { this.ranking = results; this.checking = false; this.checked.emit(); },
      error: (e: LlmApiError) => { this.checking = false; this.error = e.message; }
    });
  }

  icon(i: Issue): string {
    return i.severity === 'action' ? 'error' : i.severity === 'warning' ? 'warning' : 'info';
  }

  setStatus(i: Issue, status: IssueStatus): void {
    this.busy.add(i.id);
    this.error = null;
    this.api.setIssueStatus(this.sessionId, i.id, status).subscribe({
      next: updated => { this.busy.delete(i.id); this.changed.emit(updated); },
      error: (e: LlmApiError) => { this.busy.delete(i.id); this.error = e.message; }
    });
  }

  constructor(private api: LlmApiService) {}
}
