import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ExistingMatch, Issue, Participant, QAResult, ReactionDetail } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

@Component({
  selector: 'app-reaction-detail',
  templateUrl: './reaction-detail.component.html',
  styleUrls: ['./reaction-detail.component.scss']
})
export class ReactionDetailComponent implements OnChanges {
  @Input({ required: true }) sessionId!: string;
  @Input({ required: true }) reactionKey!: string;
  @Input() matches: ExistingMatch[] = [];
  @Input() issues: Issue[] = [];
  /** Emitted when something here changed the session (a QA run adds issues). */
  @Output() changed = new EventEmitter<void>();

  detail: ReactionDetail | null = null;
  loading = false;
  error: string | null = null;
  qa: QAResult | null = null;
  qaBusy = false;

  constructor(private api: LlmApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] || changes['reactionKey']) {
      this.qa = null;
      this.load();
    }
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.api.reaction(this.sessionId, this.reactionKey).subscribe({
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
