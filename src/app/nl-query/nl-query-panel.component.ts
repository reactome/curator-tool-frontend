import { Component, ElementRef, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
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
 * Usage: <app-nl-query-panel (dbIdSelected)="openInstance($event)" (dbIdsListed)="openList($event)"></app-nl-query-panel>
 */
@Component({
  selector: 'app-nl-query-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TextFieldModule, MatButtonModule, MatIconModule,
            MatExpansionModule, MatTooltipModule],
  template: `
    <div class="nlq">
      <form class="nlq-composer" (ngSubmit)="ask()">
        <div class="nlq-input" [class.disabled]="loading">
          <textarea #input name="question" [(ngModel)]="question" aria-label="Ask the curation graph"
                    cdkTextareaAutosize cdkAutosizeMinRows="1" cdkAutosizeMaxRows="8"
                    (keydown.enter)="onEnter($any($event))"
                    placeholder="Ask a question, e.g. Which reactions in R-HSA-109582 have no catalyst?"></textarea>
          <button mat-icon-button class="nlq-send" type="submit" matTooltip="Ask (Enter)"
                  [disabled]="loading || !question.trim()">
            <mat-icon>arrow_upward</mat-icon>
          </button>
        </div>
        <div class="nlq-footer">
          <span>Enter to send · Shift+Enter for a new line · Read-only</span>
          <button mat-button type="button" (click)="clear()" [disabled]="loading || !exchanges.length">
            <mat-icon>restart_alt</mat-icon> New conversation
          </button>
        </div>
      </form>

      <div class="nlq-log" #log>
        <div *ngIf="!exchanges.length" class="nlq-empty">
          <mat-icon class="nlq-empty-icon">hub</mat-icon>
          <div class="nlq-empty-title">What would you like to know about the curation graph?</div>
          <div class="nlq-examples">
            <button *ngFor="let ex of examples" mat-stroked-button type="button" (click)="askExample(ex)">{{ ex }}</button>
          </div>
        </div>

        <div *ngFor="let ex of exchanges" class="nlq-exchange">
          <div class="nlq-question">{{ ex.question }}</div>

          <div *ngIf="!ex.response && !ex.error" class="nlq-pending">
            <span class="nlq-spinner"></span><span>Querying the graph…</span>
          </div>

          <div *ngIf="ex.error" class="nlq-error"><mat-icon>error_outline</mat-icon><span>{{ ex.error }}</span></div>

          <div *ngIf="ex.response as r" class="nlq-reply">
            <div class="nlq-answer">{{ r.answer }}</div>

            <mat-accordion *ngIf="r.rows.length || r.queries.length" multi displayMode="flat" class="nlq-details">
              <mat-expansion-panel *ngIf="r.rows.length" [expanded]="true">
                <mat-expansion-panel-header>
                  <mat-icon>table_chart</mat-icon>
                  Results ({{ r.rows.length }}{{ r.rows_truncated ? '+' : '' }} rows)
                </mat-expansion-panel-header>
                <div class="nlq-list-actions">
                  <button *ngFor="let c of dbIdColumns(r)" mat-stroked-button type="button"
                          matTooltip="Open these instances in the schema view list, under their most specific common class"
                          (click)="listDbIds(r, c)">
                    <mat-icon>list</mat-icon> Open {{ dbIdColumns(r).length > 1 ? c + ' ' : '' }}in list view
                  </button>
                </div>
                <div class="nlq-table-wrap">
                  <table class="nlq-table">
                    <thead><tr><th *ngFor="let c of r.columns">{{ c }}</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let row of r.rows">
                        <td *ngFor="let c of r.columns">
                          <a *ngIf="isDbIdColumn(c) && row[c] != null; else plain"
                             href="" (click)="$event.preventDefault(); selectDbId(row[c])">{{ row[c] }}</a>
                          <ng-template #plain>{{ format(row[c]) }}</ng-template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </mat-expansion-panel>

              <mat-expansion-panel *ngIf="r.queries.length">
                <mat-expansion-panel-header>
                  <mat-icon>code</mat-icon>
                  Cypher ({{ r.queries.length }})
                </mat-expansion-panel-header>
                <div *ngFor="let q of r.queries" class="nlq-cypher" [class.failed]="!q.ok">
                  <pre>{{ q.cypher }}</pre>
                  <div class="nlq-meta">
                    <span *ngIf="q.ok">{{ q.row_count ?? '?' }} rows</span>
                    <span *ngIf="q.error" class="nlq-meta-error">{{ q.error }}</span>
                    <button mat-icon-button matTooltip="Copy Cypher" (click)="copy(q.cypher)">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-expansion-panel>
            </mat-accordion>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .nlq { display: flex; flex-direction: column; height: 100%; }
    .nlq-log { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 24px; padding: 16px 4px; }

    .nlq-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 12px;
                 text-align: center; color: var(--on-surface-variant); max-width: 640px; }
    .nlq-empty-icon { font-size: 40px; width: 40px; height: 40px; color: var(--primary); }
    .nlq-empty-title { font-size: 16px; font-weight: 500; color: var(--on-surface); }
    .nlq-examples { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
    .nlq-examples button { border-radius: 16px; font-weight: 400; letter-spacing: normal; }

    .nlq-exchange { display: flex; flex-direction: column; gap: 8px; }
    .nlq-question { align-self: flex-end; max-width: 80%; white-space: pre-wrap; padding: 10px 14px;
                    border-radius: 16px 16px 4px 16px;
                    background: var(--primary-container); color: var(--on-primary-container); }
    .nlq-pending { display: flex; align-items: center; gap: 10px; color: var(--on-surface-variant); padding: 4px 2px; }
    .nlq-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--outline-variant);
                   border-top-color: var(--primary); animation: nlq-spin .8s linear infinite; }
    @keyframes nlq-spin { to { transform: rotate(360deg); } }
    .nlq-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 14px; border-radius: 12px;
                 background: var(--error-container); color: var(--on-error-container); }
    .nlq-reply { background: #fff; border: 1px solid var(--outline-variant); border-radius: 12px; overflow: hidden; }
    .nlq-answer { white-space: pre-wrap; padding: 14px 16px; line-height: 1.5; }

    .nlq-details { display: block; border-top: 1px solid var(--outline-variant); }
    .nlq-details .mat-expansion-panel { box-shadow: none !important; border-radius: 0 !important; background: transparent; }
    .nlq-details .mat-expansion-panel + .mat-expansion-panel { border-top: 1px solid var(--outline-variant); }
    .nlq-details .mat-expansion-panel-header { height: 44px; padding: 0 16px; font-size: 13px; }
    .nlq-details .mat-expansion-panel-header mat-icon { font-size: 18px; width: 18px; height: 18px;
                                                        margin-right: 8px; color: var(--on-surface-variant); }

    .nlq-list-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }
    .nlq-list-actions:empty { display: none; }
    .nlq-list-actions button { letter-spacing: normal; }
    .nlq-table-wrap { max-height: 360px; overflow: auto; border: 1px solid var(--outline-variant); border-radius: 8px; }
    .nlq-table { border-collapse: collapse; font-size: 12px; width: 100%; }
    .nlq-table th { position: sticky; top: 0; background: var(--surface-variant); font-weight: 500; }
    .nlq-table th, .nlq-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--outline-variant); }
    .nlq-table tbody tr:last-child td { border-bottom: none; }
    .nlq-table tbody tr:hover { background: var(--hover); }

    .nlq-cypher + .nlq-cypher { margin-top: 12px; }
    .nlq-cypher pre { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--surface-variant);
                      white-space: pre-wrap; font-size: 12px; }
    .nlq-cypher.failed pre { border-left: 3px solid var(--error); }
    .nlq-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px;
                font-size: 12px; color: var(--on-surface-variant); }
    .nlq-meta-error { color: var(--error); }

    .nlq-composer { padding: 12px 0 8px; border-bottom: 1px solid var(--outline-variant); }
    .nlq-input { display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 18px; background: #fff;
                 border: 1px solid var(--outline); border-radius: 24px; transition: border-color .15s, box-shadow .15s; }
    .nlq-input:focus-within { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
    .nlq-input textarea { flex: 1; border: none; outline: none; resize: none; background: transparent;
                          font: inherit; font-size: 14px; line-height: 20px; padding: 10px 0; color: var(--on-surface); }
    .nlq-send { flex: none; background: var(--primary); color: var(--on-primary); }
    .nlq-send:disabled { background: var(--surface-variant); color: var(--on-surface-variant); }
    .nlq-footer button { letter-spacing: normal; }
    .nlq-footer { display: flex; align-items: center; justify-content: space-between; padding: 2px 8px 0 18px;
                  font-size: 12px; color: var(--on-surface-variant); }
  `],
})
export class NLQueryPanelComponent {
  private service = inject(NLQueryService);

  /** Emitted when a curator clicks a dbId in the results, so the host can open the instance. */
  @Output() dbIdSelected = new EventEmitter<number>();

  /** Emitted with the dbIds of a result column when a curator asks to open them in the list view. */
  @Output() dbIdsListed = new EventEmitter<number[]>();

  @ViewChild('log') private log?: ElementRef<HTMLElement>;
  @ViewChild('input') private input?: ElementRef<HTMLTextAreaElement>;

  readonly examples = [
    'Which reactions in R-HSA-109582 have no catalyst?',
    'How many human pathways were modified this month?',
    'List the complexes that contain UniProt:P04637',
  ];

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
    this.scrollToBottom();

    this.service.ask(question, history).subscribe({
      next: r => { exchange.response = r; this.loading = false; this.scrollToBottom(); },
      error: (e: HttpErrorResponse) => {
        exchange.error = e.status === 401 ? 'Your session has expired. Please log in again.'
          : e.status === 0 || e.status === 404 ? 'The graph query service is not reachable from here.'
          : (e.error?.detail ?? `Request failed (${e.status}).`);
        this.loading = false;
        this.scrollToBottom();
      },
    });
  }

  askExample(question: string): void {
    this.question = question;
    this.ask();
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

  /** The dbId columns of a result that hold at least one dbId, so there is something to list. */
  dbIdColumns(response: NLQueryResponse): string[] {
    return response.columns.filter(c => this.isDbIdColumn(c) && this.columnDbIds(response, c).length > 0);
  }

  listDbIds(response: NLQueryResponse, column: string): void {
    const dbIds = this.columnDbIds(response, column);
    if (dbIds.length) this.dbIdsListed.emit(dbIds);
  }

  private columnDbIds(response: NLQueryResponse, column: string): number[] {
    const dbIds = response.rows.map(row => row[column])
      .filter(v => v != null && v !== '')
      .map(Number)
      .filter(Number.isInteger);
    return [...new Set(dbIds)];
  }

  clear(): void {
    this.exchanges = [];
    this.input?.nativeElement.focus();
  }

  /** Wait a tick so the new exchange is rendered before scrolling to it. */
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.log?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
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
