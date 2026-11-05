import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ExistingMatch, Issue, PaperInfo, Participant, QA_PRIORITY_LABEL, QAPriority, QAResult, ReactionDetail, ReactionQA
} from '../../models/llm-api.models';

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
  /** Emitted when something here changed the session (a QA run adds issues). */
  @Output() changed = new EventEmitter<void>();
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

  constructor(private api: LlmApiService) {}

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

  get myIssues(): Issue[] {
    return this.issues.filter(i => i.reaction_key === this.reactionKey && i.status === 'open');
  }

  participants(keys: string[]): Participant[] {
    return keys.map(k => this.detail?.participants[k]).filter((p): p is Participant => !!p);
  }

  participant(key: string): Participant | undefined {
    return this.detail?.participants[key];
  }

  /** "UB, S65 O-phospho-L-serine". */
  describe(p: Participant): string {
    const mods = (p.modifications ?? []).map(m => `${m.residue ?? ''}${m.coordinate ?? ''} ${m.mod_label ?? m.psi_mod ?? ''}`.trim());
    return mods.length ? `${p.name} (${mods.join(', ')})` : p.name;
  }

  details(p: Participant): string[] {
    const out: string[] = [];
    if (p.uniprot) out.push(`UniProt ${p.uniprot}`);
    if (p.chebi) out.push(p.chebi);
    if (p.compartment_name) out.push(p.compartment_name);
    return out;
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
