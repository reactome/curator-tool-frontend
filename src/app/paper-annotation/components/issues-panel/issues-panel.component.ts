import { Component, EventEmitter, Input, Output } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import {
  ISSUE_CATEGORY_LABEL, ISSUE_CATEGORY_ORDER, Issue, IssueSeverity, IssueStatus, QA_PRIORITY_LABEL, QAPriority,
  ReactionQA, ReactionRef
} from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

const SEVERITY_RANK: Record<IssueSeverity, number> = { action: 0, warning: 1, info: 2 };
const PRIORITY_RANK: Record<QAPriority, number> = { fix_first: 0, fix: 1, review: 2, ok: 3 };
/** Issues shown per reaction before "show more". */
export const PER_REACTION = 3;

/** One reaction whose fate the curator decides first: keep it, or remove it. */
export interface KeepDecision {
  key: string;
  name: string;
  equation: string;
  reasons: Issue[];
  /** "May describe the same event as r11": decide the look-alikes together, usually keeping at most one. */
  lookalikes: Issue[];
  /** The pending suggested fix that removes it. */
  proposalId: string | null;
}

/** The issues of one reaction (or of the entities and the paper, key null), most important first. */
export interface IssueGroup {
  key: string | null;
  name: string;
  qa: ReactionQA | null;
  issues: Issue[];
}

/**
 * The issues of an annotation, organized so a curator can work through them: first the reactions that may not belong
 * (not a molecular reaction, or no result of this paper shows them), then the rest grouped by reaction, worst first.
 * The issues of a reaction that waits on that decision, and notes, are held back unless asked for.
 */
@Component({
  selector: 'app-issues-panel',
  templateUrl: './issues-panel.component.html',
  styleUrls: ['./issues-panel.component.scss']
})
export class IssuesPanelComponent {
  @Input({ required: true }) sessionId!: string;
  @Input() issues: Issue[] = [];
  /** The draft's reactions, for their names. */
  @Input() reactions: ReactionRef[] = [];
  /** Each reaction's last QA review, by key. */
  @Input() qa: Record<string, ReactionQA> = {};
  @Output() changed = new EventEmitter<Issue>();
  @Output() openReaction = new EventEmitter<string>();
  /** Emitted after checking every reaction, or after keeping/removing one, so the page re-reads the session. */
  @Output() checked = new EventEmitter<void>();
  /** Emitted after a reaction was removed (the draft changed, so staged instances are out of date). */
  @Output() removed = new EventEmitter<string>();

  status: IssueStatus | 'all' = 'open';
  showNotes = false;
  showWaiting = false;
  busy = new Set<string>();
  expanded = new Set<string>();
  error: string | null = null;
  checking = false;

  readonly perReaction = PER_REACTION;

  private matchesStatus(i: Issue): boolean {
    return this.status === 'all' || i.status === this.status;
  }

  private nameOf(key: string): string {
    return this.reactions.find(r => r.key === key)?.name ?? `reaction ${key}`;
  }

  private equationOf(key: string): string {
    return this.reactions.find(r => r.key === key)?.equation ?? '';
  }

  /** The reactions waiting on a keep-or-remove decision (open keep issues). */
  private get deciding(): Set<string> {
    return new Set(this.issues.filter(i => i.category === 'keep' && i.status === 'open' && i.reaction_key).map(i => i.reaction_key!));
  }

  /** Reactions waiting on a keep-or-remove decision: most reasons first, a look-alike right after the one it resembles. */
  get decisions(): KeepDecision[] {
    const by = new Map<string, Issue[]>();
    for (const i of this.issues) {
      if (i.category === 'keep' && i.status === 'open' && i.reaction_key) by.set(i.reaction_key, [...(by.get(i.reaction_key) ?? []), i]);
    }
    const all = [...by.entries()]
      .map(([key, reasons]) => ({
        key, name: this.nameOf(key), equation: this.equationOf(key), reasons,
        lookalikes: this.issues.filter(i => i.reaction_key === key && i.code === 'qa_possible_duplicate' && i.status === 'open'),
        proposalId: reasons.find(r => r.proposal_id)?.proposal_id ?? null
      }))
      .sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
    // put each look-alike next to the reaction it resembles ("may describe the same event as r11")
    const like = (d: KeepDecision) => d.lookalikes.map(i => /same event as (\S+)/.exec(i.message)?.[1]).find(k => k && by.has(k));
    const out: KeepDecision[] = [];
    for (const d of all.filter(x => !like(x))) {
      out.push(d, ...all.filter(x => like(x) === d.key));
    }
    return [...out, ...all.filter(x => !out.includes(x))];
  }

  /**
   * The issues listed below the decisions: not keep issues, filtered by status, notes and waiting issues held back. A
   * look-alike note of a reaction awaiting a decision is shown in that decision instead.
   */
  get listed(): Issue[] {
    const deciding = this.deciding;
    return this.issues.filter(i => i.category !== 'keep' && this.matchesStatus(i)
      && !(i.code === 'qa_possible_duplicate' && deciding.has(i.reaction_key ?? ''))
      && (this.showNotes || i.severity !== 'info') && (this.showWaiting || !i.blocked_by));
  }

  /** `listed` grouped by reaction, worst reaction first (QA priority, then most actions); entity and paper issues last. */
  get groups(): IssueGroup[] {
    const by = new Map<string | null, Issue[]>();
    for (const i of this.listed) by.set(i.reaction_key, [...(by.get(i.reaction_key) ?? []), i]);
    const order = (i: Issue) => ISSUE_CATEGORY_ORDER.indexOf(i.category ?? 'other');
    const groups: IssueGroup[] = [...by.entries()].map(([key, issues]) => ({
      key, name: key ? this.nameOf(key) : 'Entities and the paper', qa: key ? this.qa[key] ?? null : null,
      issues: issues.sort((a, b) => order(a) - order(b) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    }));
    const actions = (g: IssueGroup) => g.issues.filter(i => i.severity === 'action').length;
    const prio = (g: IssueGroup) => g.key === null ? 9 : PRIORITY_RANK[g.qa?.priority ?? 'review'];
    return groups.sort((a, b) => prio(a) - prio(b) || actions(b) - actions(a) || a.name.localeCompare(b.name));
  }

  /** The issues of a group to show: the first few, or all once expanded. */
  visible(g: IssueGroup): Issue[] {
    return this.expanded.has(g.key ?? '') ? g.issues : g.issues.slice(0, PER_REACTION);
  }

  toggle(g: IssueGroup): void {
    const k = g.key ?? '';
    if (this.expanded.has(k)) this.expanded.delete(k); else this.expanded.add(k);
  }

  get waiting(): number {
    return this.issues.filter(i => i.status === 'open' && i.blocked_by).length;
  }

  get notes(): number {
    return this.issues.filter(i => i.status === 'open' && i.severity === 'info' && !i.blocked_by && i.category !== 'keep').length;
  }

  categoryLabel(i: Issue): string {
    return ISSUE_CATEGORY_LABEL[i.category ?? 'other'];
  }

  priorityLabel(p: QAPriority | undefined): string {
    return p ? QA_PRIORITY_LABEL[p] : '';
  }

  /** Review every reaction (they run together on the service), then re-read the session. */
  checkAll(): void {
    this.checking = true;
    this.error = null;
    this.api.qaAll(this.sessionId).subscribe({
      next: () => { this.checking = false; this.checked.emit(); },
      error: (e: LlmApiError) => { this.checking = false; this.error = e.message; }
    });
  }

  /** Remove the reaction: accept the suggested fix that removes it. */
  remove(d: KeepDecision): void {
    if (!d.proposalId) return;
    this.decide(d, this.api.accept(this.sessionId, d.proposalId), () => this.removed.emit(d.key));
  }

  /** Keep the reaction: dismiss the reasons to question it, and reject the suggestion to remove it. */
  keep(d: KeepDecision): void {
    const calls: Observable<unknown>[] = d.reasons.map(r => this.api.setIssueStatus(this.sessionId, r.id, 'dismissed'));
    if (d.proposalId) calls.push(this.api.reject(this.sessionId, d.proposalId));
    this.decide(d, calls.length ? forkJoin(calls) : of(null));
  }

  private decide(d: KeepDecision, call: Observable<unknown>, done?: () => void): void {
    this.busy.add(d.key);
    this.error = null;
    call.subscribe({
      next: () => { this.busy.delete(d.key); done?.(); this.checked.emit(); },
      error: (e: LlmApiError) => { this.busy.delete(d.key); this.error = e.message; }
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
