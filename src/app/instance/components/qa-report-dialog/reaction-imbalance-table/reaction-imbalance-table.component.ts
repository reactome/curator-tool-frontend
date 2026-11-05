import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  REACTION_IMBALANCE_CHECK,
  REACTION_IMBALANCE_COLUMNS,
  ReactionImbalance
} from 'src/app/core/models/reaction-imbalance.model';
import { QAResults } from 'src/app/core/models/qa-report.model';

/**
 * True for the Pathway form of the reaction imbalance check, which this table shows. The Reaction
 * form (one reaction, a handful of proteins) has no Reaction_DBID column and is left to the generic
 * QA report table.
 */
export function isPathwayReactionImbalance(check: QAResults): boolean {
  return check.checkName === REACTION_IMBALANCE_CHECK
    && !!check.columns?.includes(REACTION_IMBALANCE_COLUMNS.reactionDbId);
}

/**
 * Regroup the flat QA report rows (one per imbalanced protein) into one entry per reaction, in the
 * order the backend sent them. Values are looked up by column name, not position, as the backend asks.
 */
export function groupReactionImbalanceRows(columns: string[], rows: string[][]): ReactionImbalance[] {
  const index = (name: string) => columns.indexOf(name);
  const c = REACTION_IMBALANCE_COLUMNS;
  const cols = {
    dbId: index(c.reactionDbId), reaction: index(c.reaction), reference: index(c.reference),
    identifier: index(c.identifier), input: index(c.input), output: index(c.output),
    cleavage: index(c.cleavage), lastAuthor: index(c.lastAuthor),
  };
  const cell = (row: string[], i: number) => (i < 0 ? '' : row[i] ?? '');
  const dbId2reaction = new Map<number, ReactionImbalance>();
  for (const row of rows) {
    const dbId = Number(cell(row, cols.dbId));
    let reaction = dbId2reaction.get(dbId);
    if (!reaction) {
      reaction = {
        dbId,
        displayName: cell(row, cols.reaction),
        cleavage: cell(row, cols.cleavage) === 'Yes',
        lastAuthor: cell(row, cols.lastAuthor),
        imbalances: [],
      };
      dbId2reaction.set(dbId, reaction);
    }
    reaction.imbalances.push({
      displayName: cell(row, cols.reference),
      identifier: cell(row, cols.identifier),
      inputCount: Number(cell(row, cols.input)),
      outputCount: Number(cell(row, cols.output)),
    });
  }
  return Array.from(dbId2reaction.values());
}

/**
 * The Pathway form of the reaction imbalance check (the desktop CuratorTool's "Imbalance Check"), shown
 * inside the QA report: one row per imbalanced reaction, expandable to the proteins whose input and
 * output counts differ. Cleavage reactions are usually expected, so they are hidden by default instead
 * of having their own tab as in the desktop tool.
 */
@Component({
  selector: 'reaction-imbalance-table',
  templateUrl: './reaction-imbalance-table.component.html',
  styleUrls: ['./reaction-imbalance-table.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class ReactionImbalanceTable implements OnChanges {
  @Input() columns: string[] = [];
  @Input() rows: string[][] = [];
  /** The checked Pathway, used to name the TSV export. */
  @Input() eventDbId: number | undefined;

  allReactions: ReactionImbalance[] = [];
  hideCleavage = true;
  filterText = '';
  expandedReaction: ReactionImbalance | undefined;

  readonly detailColumns = ['protein', 'identifier', 'input', 'output', 'delta'];
  dataSource = new MatTableDataSource<ReactionImbalance>([]);

  // Only there when the table is shown in a dialog, which then has to close for in-app navigation.
  private dialogRef = inject(MatDialogRef, { optional: true });
  private router = inject(Router);

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort)
      this.dataSource.sort = sort;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (reaction, column) => {
      switch (column) {
        case 'imbalanceCount': return reaction.imbalances.length;
        case 'cleavage': return reaction.cleavage ? 1 : 0;
        default: return (reaction as any)[column];
      }
    };
    this.dataSource.filterPredicate = (reaction, filter) => this.matchesFilter(reaction, filter);
  }

  ngOnChanges() {
    this.allReactions = groupReactionImbalanceRows(this.columns ?? [], this.rows ?? []);
    this.updateRows();
  }

  get displayedColumns(): string[] {
    const columns = ['expand', 'dbId', 'displayName', 'imbalanceCount'];
    if (!this.hideCleavage)
      columns.push('cleavage');
    columns.push('lastAuthor');
    return columns;
  }

  get cleavageCount(): number {
    return this.allReactions.filter(r => r.cleavage).length;
  }

  onHideCleavageChange(hide: boolean) {
    this.hideCleavage = hide;
    this.updateRows();
  }

  onFilterChange(text: string) {
    this.filterText = text;
    this.dataSource.filter = text.trim().toLowerCase();
  }

  toggleExpanded(reaction: ReactionImbalance) {
    this.expandedReaction = this.expandedReaction === reaction ? undefined : reaction;
  }

  formatDelta(inputCount: number, outputCount: number): string {
    const delta = outputCount - inputCount;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  /** Open the reaction in the instance view, in a new tab so the report stays open. */
  openInstance(dbId: number, event?: Event) {
    event?.stopPropagation();
    const path = `schema_view/instance/${dbId}`;
    // window.open is a no-op in some embedding contexts (in-editor preview, a blocked popup), so
    // fall back to in-app navigation, which needs the dialog out of the way.
    let opened: Window | null = null;
    try {
      opened = window.open(path, '_blank');
    } catch {
      opened = null;
    }
    if (!opened) {
      this.dialogRef?.close();
      this.router.navigateByUrl(`/${path}`);
    }
  }

  /** Export the reactions currently shown (toggle and text filter applied), one line per protein. */
  exportTsv() {
    const header = ['Reaction DB_ID', 'Reaction', 'Cleavage', 'Last author', 'Protein', 'Identifier', 'Input', 'Output'];
    const lines = [header.join('\t')];
    for (const reaction of this.dataSource.filteredData) {
      for (const imbalance of reaction.imbalances) {
        lines.push([
          reaction.dbId,
          reaction.displayName,
          reaction.cleavage,
          reaction.lastAuthor,
          imbalance.displayName,
          imbalance.identifier,
          imbalance.inputCount,
          imbalance.outputCount,
        ].map(value => `${value}`.replace(/[\t\r\n]+/g, ' ')).join('\t'));
      }
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = this.eventDbId === undefined
      ? 'reaction_imbalance.tsv'
      : `reaction_imbalance_${this.eventDbId}.tsv`;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  private updateRows() {
    this.dataSource.data = this.hideCleavage
      ? this.allReactions.filter(r => !r.cleavage)
      : this.allReactions;
    if (this.expandedReaction && !this.dataSource.data.includes(this.expandedReaction))
      this.expandedReaction = undefined;
  }

  private matchesFilter(reaction: ReactionImbalance, filter: string): boolean {
    if (!filter)
      return true;
    if (reaction.displayName.toLowerCase().includes(filter) || `${reaction.dbId}`.includes(filter))
      return true;
    return reaction.imbalances.some(imbalance =>
      imbalance.identifier.toLowerCase().includes(filter)
      || imbalance.displayName.toLowerCase().includes(filter));
  }
}
