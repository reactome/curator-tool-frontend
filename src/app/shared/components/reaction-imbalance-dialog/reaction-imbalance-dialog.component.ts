import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReactionImbalance, ReactionImbalanceReport } from 'src/app/core/models/reaction-imbalance.model';
import { DataService } from 'src/app/core/services/data.service';

export interface ReactionImbalanceDialogData {
  dbId: number;
  displayName?: string;
}

/**
 * Pathway-level view of the reaction imbalance check (the desktop CuratorTool's "Imbalance Check"):
 * one row per imbalanced reaction, expandable to the proteins whose input and output counts differ.
 * Cleavage reactions are usually expected, so they are hidden by default instead of having their
 * own tab as in the desktop tool.
 */
@Component({
  selector: 'app-reaction-imbalance-dialog',
  templateUrl: './reaction-imbalance-dialog.component.html',
  styleUrls: ['./reaction-imbalance-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
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
export class ReactionImbalanceDialogComponent implements OnDestroy {
  loading = true;
  report: ReactionImbalanceReport | undefined;
  errorMessage: string | undefined;

  hideCleavage = true;
  filterText = '';
  expandedReaction: ReactionImbalance | undefined;

  readonly detailColumns = ['protein', 'identifier', 'input', 'output', 'delta'];
  dataSource = new MatTableDataSource<ReactionImbalance>([]);

  private subscription: Subscription;

  // The table is only rendered once the report arrives, so the sort is attached when it appears.
  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort)
      this.dataSource.sort = sort;
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: ReactionImbalanceDialogData,
              public dialogRef: MatDialogRef<ReactionImbalanceDialogComponent>,
              private dataService: DataService,
              private router: Router) {
    this.dataSource.sortingDataAccessor = (reaction, column) => {
      switch (column) {
        case 'imbalanceCount': return reaction.imbalances.length;
        case 'cleavage': return reaction.cleavage ? 1 : 0;
        case 'lastAuthor': return reaction.lastAuthor ?? '';
        default: return (reaction as any)[column];
      }
    };
    this.dataSource.filterPredicate = (reaction, filter) => this.matchesFilter(reaction, filter);

    this.subscription = this.dataService.checkReactionImbalance(data.dbId).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
        this.updateRows();
      },
      error: (err: Error) => {
        // DataService has already shown the standard error notification.
        this.errorMessage = err?.message ?? 'Unknown error';
        this.loading = false;
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  get title(): string {
    return this.report?.eventDisplayName ?? this.data.displayName ?? `${this.data.dbId}`;
  }

  get displayedColumns(): string[] {
    const columns = ['expand', 'dbId', 'displayName', 'imbalanceCount'];
    if (!this.hideCleavage)
      columns.push('cleavage');
    columns.push('lastAuthor');
    return columns;
  }

  get allReactions(): ReactionImbalance[] {
    return this.report?.reactions ?? [];
  }

  get cleavageCount(): number {
    return this.allReactions.filter(r => r.cleavage).length;
  }

  /** Reactions counted in the header: cleavages drop out while they are hidden. */
  get imbalancedCount(): number {
    return this.hideCleavage ? this.allReactions.length - this.cleavageCount : this.allReactions.length;
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
      this.dialogRef.close();
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
          reaction.lastAuthor ?? '',
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
    anchor.download = `reaction_imbalance_${this.report?.eventDbId ?? this.data.dbId}.tsv`;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  onClose() {
    this.dialogRef.close();
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
