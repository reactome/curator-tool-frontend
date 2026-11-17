import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ISSUE_CATEGORY_LABEL, ISSUE_CATEGORY_ORDER, Issue, IssueSeverity, IssueStatus, Proposal } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

const SEVERITY_RANK: Record<IssueSeverity, number> = { action: 0, warning: 1, info: 2 };

/**
 * A list of issues to work through where they belong (a reaction, an entity, the annotation as a whole): each with
 * Resolve / Dismiss (or Reopen), and the suggested fix that would settle it, to accept or reject right there. Issues of
 * a reaction waiting on a keep-or-remove decision are shown dimmed; notes (info) are held back unless asked for, except
 * one that comes with a fix. The keep question itself is not listed: the reaction panel asks it.
 */
@Component({
  selector: 'app-issue-list',
  templateUrl: './issue-list.component.html',
  styleUrls: ['./issue-list.component.scss']
})
export class IssueListComponent {
  @Input({ required: true }) sessionId!: string;
  @Input() issues: Issue[] = [];
  /** The pending suggested fixes; an issue shows the one it links to (proposal_id). */
  @Input() proposals: Proposal[] = [];
  /** Shown when nothing is listed (empty string: show nothing). */
  @Input() empty = 'No open issues.';
  /** all: issues and notes (notes behind a toggle); issues: no notes; notes: only notes (info without a fix). */
  @Input() kind: 'all' | 'issues' | 'notes' = 'all';
  /** Emitted after a status change or a decided fix, so the page re-reads the session (every tab follows). */
  @Output() changed = new EventEmitter<void>();
  /** Emitted with a fix just accepted or rejected. */
  @Output() proposalDecided = new EventEmitter<Proposal>();

  showNotes = false;
  showDone = false;
  busy = new Set<string>();
  error: string | null = null;

  /** The pending fix an issue links to. */
  fixOf(i: Issue): Proposal | undefined {
    return i.proposal_id ? this.proposals.find(p => p.id === i.proposal_id && p.status === 'pending') : undefined;
  }

  private isNote(i: Issue): boolean {
    return i.severity === 'info' && !this.fixOf(i);
  }

  private get candidates(): Issue[] {
    return this.issues.filter(i => i.category !== 'keep'
      && (this.kind === 'all' || (this.kind === 'notes') === this.isNote(i)));
  }

  /** Open notes behind the toggle (none when this list is only notes, or has none). */
  get notes(): number {
    return this.kind === 'all' ? this.candidates.filter(i => i.status === 'open' && this.isNote(i)).length : 0;
  }

  get done(): number {
    return this.candidates.filter(i => i.status !== 'open').length;
  }

  get listed(): Issue[] {
    const order = (i: Issue) => ISSUE_CATEGORY_ORDER.indexOf(i.category ?? 'other');
    return this.candidates
      .filter(i => (i.status === 'open' || this.showDone)
        && (this.kind !== 'all' || this.showNotes || !this.isNote(i) || i.status !== 'open'))
      .sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || Number(!!a.blocked_by) - Number(!!b.blocked_by)
        || Number(!this.fixOf(a)) - Number(!this.fixOf(b)) || order(a) - order(b)
        || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }

  categoryLabel(i: Issue): string {
    return ISSUE_CATEGORY_LABEL[i.category ?? 'other'];
  }

  icon(i: Issue): string {
    return i.severity === 'action' ? 'error' : i.severity === 'warning' ? 'warning' : 'info';
  }

  setStatus(i: Issue, status: IssueStatus): void {
    this.busy.add(i.id);
    this.error = null;
    this.api.setIssueStatus(this.sessionId, i.id, status).subscribe({
      next: () => { this.busy.delete(i.id); this.changed.emit(); },
      error: (e: LlmApiError) => { this.busy.delete(i.id); this.error = e.message; }
    });
  }

  onDecided(p: Proposal): void {
    this.proposalDecided.emit(p);
    this.changed.emit();
  }

  constructor(private api: LlmApiService) {}
}
