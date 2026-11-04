import { Component, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { DiagramSyncIssue, DiagramSyncReport } from 'src/app/core/models/diagram-sync.model';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

/** One entry of the diagram filter: a diagram that has at least one issue. */
export interface DiagramSyncDiagramOption {
  diagramDbId: number;
  pathwayDbId: number;
  pathwayDisplayName: string;
  issueCount: number;
}

/**
 * Shows the Diagram sync QA check for a Pathway: events whose drawing in a PathwayDiagram doesn't
 * match their annotation in the database. The check covers the Pathway's diagram and those of all
 * its sub-pathways, so the table can be narrowed to one diagram.
 */
@Component({
  selector: 'diagram-sync-dialog',
  templateUrl: './diagram-sync-dialog.component.html',
  styleUrls: ['./diagram-sync-dialog.component.scss']
})
export class DiagramSyncDialogComponent implements OnDestroy {
  readonly displayedColumns = ['event', 'type', 'issue', 'diagram', 'created', 'modified'];

  loading = false;
  errorMessage: string | undefined;
  report: DiagramSyncReport | undefined;
  diagrams: DiagramSyncDiagramOption[] = [];
  /** undefined shows the issues of every diagram. */
  selectedDiagramDbId: number | undefined;
  dataSource = new MatTableDataSource<DiagramSyncIssue>([]);

  private checkSubscription: Subscription | undefined;

  // The table only exists once a report with issues is in, so the sort has to be attached
  // whenever it appears rather than once in ngAfterViewInit.
  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort)
      this.dataSource.sort = sort;
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: { pathway: Instance },
              public dialogRef: MatDialogRef<DiagramSyncDialogComponent>,
              private dataService: DataService) {
    this.dataSource.sortingDataAccessor = (issue, column) => this.sortValue(issue, column);
    this.dataSource.filterPredicate = (issue, filter) => !filter || String(issue.diagramDbId) === filter;
    this.runCheck();
  }

  ngOnDestroy(): void {
    this.checkSubscription?.unsubscribe();
  }

  runCheck() {
    this.checkSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = undefined;
    this.report = undefined;
    this.checkSubscription = this.dataService.checkDiagramSync(this.data.pathway.dbId).subscribe({
      next: report => this.applyReport(report),
      // DataService has already put up the app's usual error banner; this keeps the dialog
      // from sitting on its spinner and says what happened in place.
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.message || 'Unknown error';
      }
    });
  }

  private applyReport(report: DiagramSyncReport) {
    this.loading = false;
    this.report = report;
    // Start out grouped by diagram, so a run over a large pathway reads diagram by diagram
    // until the curator sorts on a column.
    const issues = [...(report.issues ?? [])].sort((a, b) =>
      (a.pathwayDisplayName ?? '').localeCompare(b.pathwayDisplayName ?? '') ||
      a.diagramDbId - b.diagramDbId ||
      (a.eventDisplayName ?? '').localeCompare(b.eventDisplayName ?? ''));
    this.diagrams = this.collectDiagrams(issues);
    if (this.selectedDiagramDbId !== undefined &&
        !this.diagrams.some(d => d.diagramDbId === this.selectedDiagramDbId))
      this.selectedDiagramDbId = undefined; // A re-run cleared every issue in that diagram
    this.dataSource.data = issues;
    this.applyDiagramFilter();
  }

  private collectDiagrams(issues: DiagramSyncIssue[]): DiagramSyncDiagramOption[] {
    const diagramDbId2option = new Map<number, DiagramSyncDiagramOption>();
    for (const issue of issues) {
      let option = diagramDbId2option.get(issue.diagramDbId);
      if (!option) {
        option = {
          diagramDbId: issue.diagramDbId,
          pathwayDbId: issue.pathwayDbId,
          pathwayDisplayName: issue.pathwayDisplayName,
          issueCount: 0
        };
        diagramDbId2option.set(issue.diagramDbId, option);
      }
      option.issueCount++;
    }
    return Array.from(diagramDbId2option.values());
  }

  selectDiagram(diagramDbId: number | undefined) {
    this.selectedDiagramDbId = diagramDbId;
    this.applyDiagramFilter();
  }

  private applyDiagramFilter() {
    this.dataSource.filter = this.selectedDiagramDbId === undefined ? '' : String(this.selectedDiagramDbId);
  }

  private sortValue(issue: DiagramSyncIssue, column: string): string | number {
    switch (column) {
      case 'event': return (issue.eventDisplayName ?? '').toLowerCase();
      case 'type': return issue.eventSchemaClass ?? '';
      case 'issue': return issue.issue ?? '';
      case 'diagram': return issue.diagramDbId;
      case 'created': return issue.created ?? '';
      case 'modified': return issue.modified ?? '';
      default: return '';
    }
  }

  get issueCount(): number {
    return this.report?.issues?.length ?? 0;
  }

  get uncheckedDiagramDbIds(): number[] {
    return this.report?.uncheckedDiagramDbIds ?? [];
  }

  isPathway(issue: DiagramSyncIssue): boolean {
    return issue.eventSchemaClass === 'Pathway';
  }

  // Links open in a new tab, as in the other QA report tables, so the results stay put while the
  // curator works through them. The URLs are relative so they keep the deployed base href.
  instanceUrl(dbId: number): string {
    return `schema_view/instance/${dbId}`;
  }

  /**
   * The event view for the issue's diagram with both ends of the FlowLine selected: the flagged
   * event first, which is also the one the event tree and the instance editor open.
   */
  highlightInDiagramUrl(issue: DiagramSyncIssue): string {
    const select = issue.missingPrecedingEventDbId !== undefined
      ? `${issue.eventDbId},${issue.missingPrecedingEventDbId}`
      : `${issue.eventDbId}`;
    return `event_view/instance/${issue.pathwayDbId}?select=${select}`;
  }

  onClose() {
    this.dialogRef.close();
  }
}
