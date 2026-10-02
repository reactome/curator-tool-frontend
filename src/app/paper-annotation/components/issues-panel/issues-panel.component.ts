import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Issue, IssueSeverity, IssueStatus } from '../../models/llm-api.models';
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

  status: IssueStatus | 'all' = 'open';
  severity: IssueSeverity | 'all' = 'all';
  busy = new Set<string>();
  error: string | null = null;

  get shown(): Issue[] {
    return this.issues
      .filter(i => (this.status === 'all' || i.status === this.status) && (this.severity === 'all' || i.severity === this.severity))
      .sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.reaction_key ?? '').localeCompare(b.reaction_key ?? ''));
  }

  count(severity: IssueSeverity): number {
    return this.issues.filter(i => i.status === 'open' && i.severity === severity).length;
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
