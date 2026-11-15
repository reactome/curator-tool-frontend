import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import {
  ExistingMatch, Issue, PaperInfo, Participant, Proposal, QA_PRIORITY_LABEL, QAPriority, QAResult, ReactionDetail, ReactionQA
} from '../../models/llm-api.models';
import { CompartmentChip, compartmentChip, describeParticipant } from '../../models/compartment-chip';
import { StagedInstance } from '../instance-model/instance-model.component';

const NO_ISSUES: Issue[] = [];

/** What the QA box shows: the review saved with the session, or the one just run here. */
export interface QAView {
  priority: QAPriority | null;
  verdict?: string;
  summary: string | null;
  score: number | null;
  isReaction: boolean | null;
  llmUsed: boolean;
}
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

@Component({
  selector: 'app-reaction-detail',
  templateUrl: './reaction-detail.component.html',
  styleUrls: ['./reaction-detail.component.scss']
})
export class ReactionDetailComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) sessionId!: string;
  @Input({ required: true }) reactionKey!: string;
  @Input() matches: ExistingMatch[] = [];
  @Input() issues: Issue[] = [];
  /** The session's papers, so a quote can say which one it is from (only shown when there are several). */
  @Input() papers: PaperInfo[] = [];
  /** This reaction's last QA review as saved with the session (run automatically after the pipeline), if any. */
  @Input() savedQa: ReactionQA | null = null;
  /**
   * Changes when the draft may have changed (an accepted chat or suggestion edit, a QA run); the reaction is re-read.
   * Without it, accepting a change the chat proposed for the open reaction left this panel showing the old version
   * until the curator selected another reaction and came back: sessionId and reactionKey had not changed, so
   * nothing told the panel to fetch again.
   */
  @Input() stamp = 0;
  /** The pending suggested fixes of the annotation: each issue shows the one that settles it. */
  @Input() proposals: Proposal[] = [];
  /** The exported instances by dbId, for "As Reactome instances". */
  @Input() instances: Record<number, StagedInstance> = {};
  /**
   * Emitted when something here changed the session (a QA run, an issue resolved or dismissed, a fix accepted or
   * rejected, the reaction kept): the page re-reads it, so every tab shows the same state.
   */
  @Output() changed = new EventEmitter<void>();
  /** Emitted with a fix accepted or rejected here (an accepted one makes the staged instances out of date). */
  @Output() proposalDecided = new EventEmitter<Proposal>();
  /** Emitted with a participant's key: show it in the Entities tab. */
  @Output() openEntity = new EventEmitter<string>();
  /** Emitted with the reaction's key once the curator removed it from the draft. */
  @Output() removed = new EventEmitter<string>();

  detail: ReactionDetail | null = null;
  loading = false;
  error: string | null = null;
  qa: QAResult | null = null;
  qaBusy = false;
  /** Asking "remove this reaction?" before doing it. */
  confirmRemove = false;
  removing = false;
  /** Keeping or removing it from the "keep this reaction?" question. */
  deciding = false;
  /** "As Reactome instances": what loading creates, the panel's main output, so it starts open. */
  showInstances = true;

  /** The Cancel button of an open remove question: it takes the focus, so Enter or Escape keeps the reaction. */
  @ViewChild('cancelRemoveButton', { read: ElementRef }) cancelRemoveButton?: ElementRef<HTMLButtonElement>;

  constructor(private api: LlmApiService) {}

  askRemove(): void {
    this.confirmRemove = true;
    setTimeout(() => this.cancelRemoveButton?.nativeElement.focus());
  }

  private loadSub?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] || changes['reactionKey']) {
      this.qa = null;
      this.confirmRemove = false;
      this.load();
    } else if (changes['stamp']) {
      // Same reaction, possibly edited: re-read it, keeping what is shown until the new version arrives. The QA
      // result just run here is kept: a QA run itself bumps the stamp (it adds issues, so the page reloads).
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
  }

  private load(): void {
    // Drop a fetch still in flight, so a slow answer for the previous reaction (or an older version of this
    // one) cannot land after the newer one and overwrite it.
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = null;
    this.loadSub = this.api.reaction(this.sessionId, this.reactionKey).subscribe({
      next: d => { this.detail = d; this.loading = false; },
      error: (e: LlmApiError) => { this.error = e.message; this.loading = false; }
    });
  }

  get myMatches(): ExistingMatch[] {
    return this.matches.filter(m => m.reaction_key === this.reactionKey);
  }

  /** This reaction's issues (any status: the list filters them); the keep question is asked above them. */
  get myIssues(): Issue[] {
    return this.issues.filter(i => i.reaction_key === this.reactionKey);
  }

  /** The keys of the entities this reaction uses (its participants and their parts). */
  get entityKeys(): Set<string> {
    const out = new Set<string>();
    const P = this.detail?.participants ?? {};
    const add = (k: string) => {
      if (out.has(k)) return;
      out.add(k);
      const p = P[k];
      [...(p?.components ?? []), ...(p?.members ?? [])].forEach(add);
    };
    Object.keys(P).forEach(add);
    return out;
  }

  /** Issues about the entities this reaction uses (a compartment the paper does not give, an identifier): the same
   *  issues the Entities tab lists, so they can be fixed from either place. */
  get entityIssues(): Issue[] {
    const keys = this.entityKeys;
    return this.issues.filter(i => !i.reaction_key && !!i.participant_key && keys.has(i.participant_key));
  }

  private entityIssueCache: { issues: Issue[]; by: Map<string, Issue[]> } | null = null;

  /** An entity's own issues; the same array until the issues change, so the lists under the rows are not rebuilt. */
  issuesOfEntity(key: string): Issue[] {
    if (this.entityIssueCache?.issues !== this.issues) {
      const by = new Map<string, Issue[]>();
      for (const i of this.issues) {
        if (!i.reaction_key && i.participant_key) by.set(i.participant_key, [...(by.get(i.participant_key) ?? []), i]);
      }
      this.entityIssueCache = { issues: this.issues, by };
    }
    return this.entityIssueCache.by.get(key) ?? NO_ISSUES;
  }

  private entityCache: { detail: ReactionDetail; rows: { role: string; p: Participant }[] } | null = null;

  /** The reaction's entities with their role: inputs, outputs, catalyst, regulators, then the parts of complexes and
   *  sets (each once). Computed once per loaded reaction: new row objects on every check made Angular rebuild the rows
   *  (and their issue lists and tooltips) on every mouse move, which could stall the panel. */
  get entities(): { role: string; p: Participant }[] {
    if (this.detail && this.entityCache?.detail === this.detail) return this.entityCache.rows;
    const rows = this.computeEntities();
    if (this.detail) this.entityCache = { detail: this.detail, rows };
    return rows;
  }

  trackEntity(_: number, e: { role: string; p: Participant }): string {
    return e.p.key;
  }

  private computeEntities(): { role: string; p: Participant }[] {
    const r = this.detail?.reaction;
    const P = this.detail?.participants ?? {};
    if (!r) return [];
    const out: { role: string; p: Participant }[] = [];
    const seen = new Set<string>();
    const add = (role: string, k: string) => {
      const p = P[k];
      if (!p || seen.has(k)) return;
      seen.add(k);
      out.push({ role, p });
    };
    r.inputs.forEach(k => add('input', k));
    r.outputs.forEach(k => add('output', k));
    if (r.catalyst) add('catalyst', r.catalyst.entity);
    r.regulations.forEach(g => add(this.regulationLabel(g.kind), g.regulator));
    for (let i = 0; i < out.length; i++) {
      const p = out[i].p;
      (p.components ?? []).forEach(k => add(`part of ${p.name}`, k));
      (p.members ?? []).forEach(k => add(`member of ${p.name}`, k));
    }
    return out;
  }

  /** The open reasons to question the reaction ("not a molecular reaction", "only cited"...). */
  get keepReasons(): Issue[] {
    return this.issues.filter(i => i.reaction_key === this.reactionKey && i.category === 'keep' && i.status === 'open');
  }

  /** "May describe the same event as r11": decide look-alikes together. */
  get lookalikes(): Issue[] {
    return this.issues.filter(i => i.reaction_key === this.reactionKey && i.code === 'qa_possible_duplicate' && i.status === 'open');
  }

  /** The pending suggestion that removes it, if any. */
  get removalProposal(): Proposal | undefined {
    const id = this.keepReasons.find(r => r.proposal_id)?.proposal_id;
    return id ? this.proposals.find(p => p.id === id && p.status === 'pending') : undefined;
  }

  /** Pending suggested fixes for this reaction that no listed issue links to (those are shown under their issue). */
  get otherFixes(): Proposal[] {
    const linked = new Set([...this.issues.filter(i => i.proposal_id).map(i => i.proposal_id!)]);
    return this.proposals.filter(p => p.status === 'pending' && p.actor === 'suggestions'
      && p.reaction_keys.includes(this.reactionKey) && !linked.has(p.id));
  }

  /** Keep it: dismiss the reasons to question it and reject the suggestion to remove it. */
  keep(): void {
    const calls: Observable<unknown>[] = this.keepReasons.map(r => this.api.setIssueStatus(this.sessionId, r.id, 'dismissed'));
    const p = this.removalProposal;
    if (p) calls.push(this.api.reject(this.sessionId, p.id));
    this.deciding = true;
    this.error = null;
    const call: Observable<unknown> = calls.length ? forkJoin(calls) : of(null);
    call.subscribe({
      next: () => { this.deciding = false; this.changed.emit(); },
      error: (e: LlmApiError) => { this.deciding = false; this.error = e.message; }
    });
  }

  /** Remove it from the keep question: as the Remove button does (the suggestion and the button make the same patch). */
  removeFromDecision(): void {
    this.remove();
  }

  onFixDecided(p: Proposal): void {
    this.proposalDecided.emit(p);
    this.changed.emit();
  }

  /** "UB (S65 O-phospho-L-serine)". */
  describe(p: Participant): string {
    return describeParticipant(p);
  }

  details(p: Participant): string[] {
    const out: string[] = [];
    if (p.uniprot) out.push(`UniProt ${p.uniprot}`);
    if (p.chebi) out.push(p.chebi);
    return out;
  }

  /** The compartment chip: where the participant is and how we know (the paper's passage), or that the paper does not say. */
  compartment(p: Participant): CompartmentChip {
    return compartmentChip(p);
  }

  get reactionCompartments(): string {
    return (this.detail?.reaction.compartments ?? []).map(c => c.display_name).join(', ');
  }

  /** The review to show: the one just run here, else the saved one. Its findings are in "Needs attention". */
  get qaView(): QAView | null {
    if (this.qa) {
      return { priority: this.qa.priority ?? null, verdict: this.qa.verdict, summary: this.qa.summary ?? null,
               score: this.qa.score ?? null, isReaction: this.qa.is_reaction ?? null, llmUsed: this.qa.llm_used };
    }
    const s = this.savedQa;
    return s ? { priority: s.priority, summary: s.summary, score: s.score, isReaction: s.is_reaction, llmUsed: s.score !== null } : null;
  }

  /** The ranked label; an older service sends only a verdict. */
  qaLabel(q: QAView): string {
    return q.priority ? QA_PRIORITY_LABEL[q.priority] : q.verdict === 'ok' ? 'No blocking problems found' : 'Needs work';
  }

  /** Remove the reaction from the draft (after the curator confirmed). The page re-reads everything. */
  remove(): void {
    const key = this.reactionKey;
    this.removing = true;
    this.error = null;
    this.api.removeReaction(this.sessionId, key).subscribe({
      next: () => { this.removing = false; this.confirmRemove = false; this.removed.emit(key); },
      error: (e: LlmApiError) => { this.removing = false; this.error = e.message; }
    });
  }

  runQa(): void {
    this.qaBusy = true;
    this.api.qa(this.sessionId, this.reactionKey).subscribe({
      next: r => { this.qa = r; this.qaBusy = false; this.changed.emit(); },
      error: (e: LlmApiError) => { this.error = e.message; this.qaBusy = false; }
    });
  }

  regulationLabel(kind: string): string {
    return kind === 'requirement' ? 'required by' : kind === 'positive' ? 'activated by' : 'inhibited by';
  }
}
