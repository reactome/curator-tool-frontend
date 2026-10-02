import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Proposal } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

/** One proposed edit: what it changes, the quotes behind it, and accept / reject. Nothing is applied until accepted. */
@Component({
  selector: 'app-proposal-card',
  templateUrl: './proposal-card.component.html',
  styleUrls: ['./proposal-card.component.scss']
})
export class ProposalCardComponent {
  @Input({ required: true }) sessionId!: string;
  @Input({ required: true }) proposal!: Proposal;
  /** Emitted with the proposal's new state after it was accepted or rejected. */
  @Output() decided = new EventEmitter<Proposal>();

  busy = false;
  error: string | null = null;
  showEvidence = false;

  constructor(private api: LlmApiService) {}

  get statusLabel(): string {
    return ({ pending: 'waiting for your decision', accepted: 'accepted', rejected: 'rejected',
      stale: 'no longer applies (the annotation changed)' } as Record<string, string>)[this.proposal.status];
  }

  accept(): void {
    this.decide(this.api.accept(this.sessionId, this.proposal.id), r => r.proposal);
  }

  reject(): void {
    this.decide(this.api.reject(this.sessionId, this.proposal.id), p => p);
  }

  private decide<T>(call: import('rxjs').Observable<T>, pick: (r: T) => Proposal): void {
    this.busy = true;
    this.error = null;
    call.subscribe({
      next: r => { this.busy = false; this.decided.emit(pick(r)); },
      error: (e: LlmApiError) => {
        this.busy = false;
        this.error = e.message;
        // a 409 means it was decided elsewhere or went stale: show the real state
        if (e.status === 409) this.api.proposals(this.sessionId).subscribe(list => {
          const fresh = list.find(p => p.id === this.proposal.id);
          if (fresh) this.decided.emit(fresh);
        });
      }
    });
  }
}
