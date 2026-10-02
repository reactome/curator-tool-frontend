import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { UsageEntry, UsageReport, UsageStep } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

const LABELS: Record<UsageStep, string> = {
  extraction: 'Reading the paper (extraction)',
  merge: 'Merging duplicate reactions',
  review: 'Cross-model review',
  draft: 'Building the Reactome draft',
  qa: 'Reaction checks',
  chat: 'Chat',
};

/** How many language-model tokens each step of this annotation used. Steps that call no model are not listed. */
@Component({
  selector: 'app-usage-panel',
  templateUrl: './usage-panel.component.html',
  styleUrls: ['./usage-panel.component.scss']
})
export class UsagePanelComponent implements OnChanges {
  @Input({ required: true }) sessionId!: string;
  /** Changes whenever something that spends tokens may have happened; the panel reloads. */
  @Input() stamp = 0;

  report: UsageReport | null = null;
  loading = false;
  error: string | null = null;

  constructor(private api: LlmApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] || changes['stamp'])
      this.load();
  }

  private load(): void {
    this.loading = true;
    this.api.usage(this.sessionId).subscribe({
      next: r => { this.report = r; this.error = null; this.loading = false; },
      error: (e: LlmApiError) => { this.error = e.message; this.loading = false; }
    });
  }

  label(step: UsageStep): string {
    return LABELS[step] ?? step;
  }

  /** Cache columns only appear when the provider reported cache use, so they do not clutter the common case. */
  get hasCache(): boolean {
    return !!this.report?.steps.some(s => s.cache_read_tokens || s.cache_write_tokens);
  }

  get anySaved(): boolean {
    return !!this.report?.steps.some(s => s.saved);
  }

  /** Checks and chat turns one by one, newest last: what the "Reaction checks" and "Chat" rows add up. */
  get details(): UsageEntry[] {
    return (this.report?.entries ?? []).filter(e => e.step === 'qa' || e.step === 'chat').sort((a, b) => a.at - b.at);
  }

  detailLabel(e: UsageEntry): string {
    return e.step === 'qa' ? `Check of reaction ${e.detail ?? ''}`.trim() : `Chat, ${e.detail ?? 'a turn'}`;
  }
}
