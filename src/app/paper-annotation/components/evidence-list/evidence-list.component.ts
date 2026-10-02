import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Evidence } from '../../models/llm-api.models';

@Component({
  selector: 'app-evidence-list',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './evidence-list.component.html',
  styleUrls: ['./evidence-list.component.scss']
})
export class EvidenceListComponent {
  @Input() evidence: Evidence[] = [];

  verifyLabel(e: Evidence): string {
    switch (e.verified) {
      case 'exact': return 'verbatim';
      case 'fuzzy': return 'close match';
      case 'failed': return 'not found in paper';
      default: return 'not checked';
    }
  }

  verifyHint(e: Evidence): string {
    switch (e.verified) {
      case 'exact': return 'The quote was found word for word in the paper.';
      case 'fuzzy': return `The quote matches the paper closely (${Math.round(e.match_score ?? 0)}%); differences are usually PDF symbols or hyphenation.`;
      case 'failed': return 'The quote could not be found in the paper.';
      default: return 'This quote has not been checked against the paper text.';
    }
  }

  /** "regulatedBy[0]" -> "regulator 1", "catalystActivity" -> "catalyst". */
  supportLabel(s: string): string {
    const reg = /^regulatedBy\[(\d+)\]$/.exec(s);
    if (reg) return `regulator ${Number(reg[1]) + 1}`;
    return ({ catalystActivity: 'catalyst', reaction: 'reaction' } as Record<string, string>)[s] ?? s;
  }

  origin(e: Evidence): string | null {
    if (e.claim_origin === 'cited') return e.cited_reference ? `cited from ${e.cited_reference}` : 'cited from earlier work';
    if (e.claim_origin === 'curator_assertion') return 'curator assertion';
    return null;
  }

  trackById(_: number, e: Evidence): string {
    return e.id || e.quote;
  }
}
