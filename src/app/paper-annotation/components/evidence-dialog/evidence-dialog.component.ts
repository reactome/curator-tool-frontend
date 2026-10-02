import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { InstanceEvidence } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { EvidenceListComponent } from '../evidence-list/evidence-list.component';

export interface EvidenceDialogData {
  /** The annotation session whose instances are staged. */
  sessionId: string;
  /** The staged instance's dbId, which is the id the session exported it with. */
  dbId: number;
  title: string;
}

/**
 * The quotes from the paper behind one staged instance. Standalone so the instance view (a different lazy
 * module) can open it without loading the paper-annotation module.
 */
@Component({
  selector: 'app-evidence-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressBarModule, EvidenceListComponent],
  template: `
    <h2 mat-dialog-title>Evidence from the paper</h2>
    <mat-dialog-content>
      <p class="subject">{{ data.title }}</p>
      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>
      <p class="error" *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="!loading && !error && !groups.length">No quotes are recorded for this instance.</p>
      <section *ngFor="let g of groups">
        <h3>{{ g.label }}</h3>
        <app-evidence-list [evidence]="g.items"></app-evidence-list>
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close cdkFocusInitial>Close</button></mat-dialog-actions>`,
  styles: ['.subject { color: #555; margin-top: 0; } h3 { margin: 12px 0 0; font-size: 14px; font-weight: 500; } .error { color: #7a1c14; }']
})
export class EvidenceDialogComponent implements OnInit {
  loading = true;
  error: string | null = null;
  groups: { label: string; items: InstanceEvidence['evidence'][] }[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: EvidenceDialogData, private api: LlmApiService) {}

  ngOnInit(): void {
    this.api.instanceEvidence(this.data.sessionId, this.data.dbId).subscribe({
      next: list => { this.groups = EvidenceDialogComponent.group(list); this.loading = false; },
      error: (e: LlmApiError) => {
        this.loading = false;
        this.error = e.status === 404
          ? 'The annotation these instances came from is no longer available.'
          : e.message;
      }
    });
  }

  /** One group per field the quotes support, in the order the server listed them. */
  static group(list: InstanceEvidence[]): { label: string; items: InstanceEvidence['evidence'][] }[] {
    const order: string[] = [];
    const by = new Map<string, InstanceEvidence['evidence'][]>();
    for (const x of list) {
      if (!by.has(x.field)) { by.set(x.field, []); order.push(x.field); }
      by.get(x.field)!.push(x.evidence);
    }
    return order.map(f => ({ label: EvidenceDialogComponent.fieldLabel(f), items: by.get(f)! }));
  }

  static fieldLabel(field: string): string {
    const reg = /^regulatedBy\[(\d+)\]$/.exec(field);
    if (reg) return `Regulator ${Number(reg[1]) + 1}`;
    const labels: Record<string, string> = {
      catalystActivity: 'Catalyst', reaction: 'The reaction', input: 'Inputs', output: 'Outputs',
      compartment: 'Compartment', condition: 'Condition'
    };
    return labels[field] ?? field;
  }
}
