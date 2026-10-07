import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { NLQueryResponse, NLQueryService, NLQueryTurn } from './nl-query.service';

interface Exchange {
  question: string;
  response?: NLQueryResponse;
  error?: string;
}

/**
 * Ask-the-graph panel: curators type a question in plain English and get an
 * answer, the Cypher that was run, and the result rows. Read-only.
 *
 * Usage: <app-nl-query-panel (dbIdSelected)="openInstance($event)"></app-nl-query-panel>
 */
@Component({
  selector: 'app-nl-query-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
            MatInputModule, MatProgressBarModule, MatExpansionModule],
  template: `
    <div class="nlq">
      <div class="nlq-log">
        <div *ngFor="let ex of exchanges" class="nlq-exchange">
          <div class="nlq-question"><mat-icon>person</mat-icon><span>{{ ex.question }}</span></div>

          <div *ngIf="ex.error" class="nlq-error"><mat-icon>error_outline</mat-icon>{{ ex.error }}</div>

          <ng-container *ngIf="ex.response as r">
            <div class="nlq-answer">{{ r.answer }}</div>

            <mat-accordion multi>
              <mat-expansion-panel *ngIf="r.rows.length">
                <mat-expansion-panel-header>
                  Results ({{ r.rows.length }}{{ r.rows_truncated ? '+' : '' }} rows)
                </mat-expansion-panel-header>
                <div class="nlq-table-wrap">
                  <table class="nlq-table">
                    <tr><th *ngFor="let c of r.columns">{{ c }}</th></tr>
                    <tr *ngFor="let row of r.rows">
                      <td *ngFor="let c of r.columns">
                        <a *ngIf="isDbIdColumn(c) && row[c] != null; else plain"
                           href="" (click)="$event.preventDefault(); selectDbId(row[c])">{{ row[c] }}</a>
                        <ng-template #plain>{{ format(row[c]) }}</ng-template>
                      </td>
                    </tr>
                  </table>
                </div>
              </mat-expansion-panel>

              <mat-expansion-panel *ngIf="r.queries.length">
                <mat-expansion-panel-header>Cypher ({{ r.queries.length }})</mat-expansion-panel-header>
                <div *ngFor="let q of r.queries" class="nlq-cypher" [class.failed]="!q.ok">
                  <pre>{{ q.cypher }}</pre>
                  <div class="nlq-meta">
                    <span *ngIf="q.ok">{{ q.row_count ?? '?' }} rows</span>
                    <span *ngIf="q.error">{{ q.error }}</span>
                    <button mat-icon-button title="Copy Cypher" (click)="copy(q.cypher)">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-expansion-panel>
            </mat-accordion>
          </ng-container>
        </div>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

      <form class="nlq-input" (ngSubmit)="ask()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Ask the curation graph</mat-label>
          <textarea matInput name="question" [(ngModel)]="question" [disabled]="loading" rows="2"
                    (keydown.enter)="onEnter($any($event))"
                    placeholder="e.g. Which reactions in R-HSA-109582 have no catalyst?"></textarea>
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="loading || !question.trim()">
          <mat-icon>send</mat-icon> Ask
        </button>
        <button mat-button type="button" (click)="clear()" [disabled]="loading || !exchanges.length">Clear</button>
      </form>
    </div>
  `,
  styles: [`
    .nlq { display: flex; flex-direction: column; height: 100%; gap: 8px; }
    .nlq-log { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 16px; }
    .nlq-question { display: flex; gap: 6px; align-items: flex-start; font-weight: 500; }
    .nlq-answer { white-space: pre-wrap; margin: 8px 0 8px 30px; }
    .nlq-error { display: flex; gap: 6px; color: #b00020; margin-left: 30px; }
    .nlq-table-wrap { max-height: 320px; overflow: auto; }
    .nlq-table { border-collapse: collapse; font-size: 12px; }
    .nlq-table th, .nlq-table td { border: 1px solid rgba(128,128,128,.3); padding: 2px 6px; text-align: left; }
    .nlq-cypher pre { margin: 0; padding: 6px; background: rgba(128,128,128,.12); white-space: pre-wrap; font-size: 12px; }
    .nlq-cypher.failed pre { border-left: 3px solid #b00020; }
    .nlq-meta { display: flex; align-items: center; justify-content: space-between; font-size: 12px; opacity: .8; }
    .nlq-input { display: flex; gap: 8px; align-items: center; }
    .nlq-input mat-form-field { flex: 1; }
  `],
})
export class NLQueryPanelComponent {
  private service = inject(NLQueryService);

  /** Emitted when a curator clicks a dbId in the results, so the host can open the instance. */
  @Output() dbIdSelected = new EventEmitter<number>();

  question = '';
  loading = false;
  exchanges: Exchange[] = [];

  ask(): void {
    const question = this.question.trim();
    if (!question || this.loading) return;

    const history: NLQueryTurn[] = this.exchanges
      .filter(ex => ex.response)
      .flatMap(ex => [
        { role: 'user' as const, content: ex.question },
        { role: 'assistant' as const, content: ex.response!.answer },
      ]);

    const exchange: Exchange = { question };
    this.exchanges.push(exchange);
    this.question = '';
    this.loading = true;

    this.service.ask(question, history).subscribe({
      next: r => { exchange.response = r; this.loading = false; },
      error: (e: HttpErrorResponse) => {
        exchange.error = e.status === 401 ? 'Your session has expired. Please log in again.'
          : e.status === 0 || e.status === 404 ? 'The graph query service is not reachable from here.'
          : (e.error?.detail ?? `Request failed (${e.status}).`);
        this.loading = false;
      },
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (event.shiftKey) return; // Shift+Enter inserts a newline
    event.preventDefault();
    this.ask();
  }

  selectDbId(value: unknown): void {
    const dbId = Number(value);
    if (Number.isFinite(dbId)) this.dbIdSelected.emit(dbId);
  }

  clear(): void {
    this.exchanges = [];
  }

  isDbIdColumn(column: string): boolean {
    return /(^|\.|_)dbId$/i.test(column);
  }

  format(value: unknown): string {
    if (value === null || value === undefined) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text);
  }
}
