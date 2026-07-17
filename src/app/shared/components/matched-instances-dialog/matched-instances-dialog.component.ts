import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ListInstancesModule } from 'src/app/schema-view/list-instances/list-instances.module';
import { ActionButton } from 'src/app/schema-view/list-instances/components/list-instances-view/instance-list-table/instance-list-table.component';

/**
 * A new instance along with the existing database instances that matched it.
 */
export interface MatchedNewInstanceGroup {
  newInstance: Instance;
  matches: Instance[];
}

export interface MatchedInstancesDialogData {
  title: string;
  groups: MatchedNewInstanceGroup[];
  instances?: Instance[];
  matches?: Instance[];
  matchedGroups?: MatchedNewInstanceGroup[];
  newInstance?: Instance;
}

/**
 * Dialog shown when one or more new instances being committed have matching
 * instances already in the database. By default these new instances are not
 * committed; this dialog lets the user review the matches for each of them
 * and, if desired, commit the new instance(s) anyway despite the matches.
 */
@Component({
  selector: 'app-matched-instances-dialog',
  templateUrl: './matched-instances-dialog.component.html',
  styleUrls: ['./matched-instances-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    ListInstancesModule,
  ]
})
export class MatchedInstancesDialogComponent {
  readonly groups: MatchedNewInstanceGroup[];
  /** Action buttons shown on each matched row; only the "launch" (open) action is offered here. */
  actionButtons: ActionButton[] = [ACTION_BUTTONS.LAUNCH];
  /** Indices of the groups whose matches table is currently expanded. */
  private readonly expanded = new Set<number>();
  /** Indices of the groups whose new instance is selected to be committed anyway. */
  private readonly selected = new Set<number>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchedInstancesDialogData,
    public dialogRef: MatDialogRef<MatchedInstancesDialogComponent, Instance[]>,
    private router: Router
  ) {
    this.groups = this.normalizeGroups(this.extractGroups(data));
    // Expand the first group by default, mirroring the referrers table.
    if (this.groups.length > 0) {
      this.expanded.add(0);
    }
    console.debug('[MatchedInstancesDialog] groups:', this.groups.length,
      'matchCounts:', this.groups.map(group => this.getMatchedRows(group).length));
  }

  isExpanded(index: number): boolean {
    return this.expanded.has(index);
  }

  toggle(index: number): void {
    if (this.expanded.has(index)) {
      this.expanded.delete(index);
    } else {
      this.expanded.add(index);
    }
  }

  isSelected(index: number): boolean {
    return this.selected.has(index);
  }

  toggleSelection(index: number): void {
    if (this.selected.has(index)) {
      this.selected.delete(index);
    } else {
      this.selected.add(index);
    }
  }

  get hasSelection(): boolean {
    return this.selected.size > 0;
  }

  onClose(): void {
    this.dialogRef.close([]);
  }

  onCommitAnyway(): void {
    const selectedInstances = this.groups
      .filter((_, index) => this.selected.has(index))
      .map(group => group.newInstance);
    this.dialogRef.close(selectedInstances);
  }

  getMatchedRows(group: MatchedNewInstanceGroup): Instance[] {
    // Return the already-normalized array built once in normalizeGroups(). Do NOT
    // re-normalize here: this is bound as [dataSource]="getMatchedRows(group)", so
    // returning a fresh array of fresh row objects on every change-detection cycle
    // makes the mat-table re-render all rows (it diffs by object identity). That
    // destroys and recreates the action buttons mid-interaction, so a real mouse
    // click (mousedown then mouseup on what is now a different element) never fires
    // a click event, and the launch action is silently lost.
    return group?.matches ?? [];
  }

  /** Handle action-button clicks emitted by the shared instance list table. */
  handleAction(actionEvent: { instance: Instance, action: string }): void {
    if (actionEvent.action === ACTION_BUTTONS.LAUNCH.name) {
      this.openInstance(actionEvent.instance?.dbId);
    }
  }

  openInstance(dbId: number): void {
    if (dbId === undefined || dbId === null || (dbId as any) === '') {
      return;
    }
    const path = `schema_view/instance/${dbId}`;
    // Prefer opening the instance in a new tab. In some embedding contexts
    // (in-editor preview / webview, or a blocked popup) window.open is a no-op
    // and returns null; fall back to in-app router navigation so the launch
    // action always does something.
    let opened: Window | null = null;
    try {
      opened = window.open(path, '_blank');
    } catch {
      opened = null;
    }
    if (!opened) {
      this.dialogRef.close([]);
      this.router.navigateByUrl(`/${path}`);
    }
  }

  private normalizeGroups(groups: unknown): MatchedNewInstanceGroup[] {
    if (!Array.isArray(groups)) {
      return [];
    }
    return groups.map((group: any) => ({
      newInstance: (this.normalizeInstance(group?.newInstance)
        || this.normalizeInstance(group)
        || ({ dbId: null as any, displayName: '', schemaClassName: '' } as Instance)),
      matches: this.normalizeMatches(group?.matches)
    }));
  }

  private extractGroups(data: MatchedInstancesDialogData | undefined): unknown {
    if (!data) {
      return [];
    }
    if (Array.isArray(data.groups)) {
      return data.groups;
    }
    if (Array.isArray((data as any).matchedGroups)) {
      return (data as any).matchedGroups;
    }
    const matches = (data as any).matches ?? (data as any).instances;
    if (Array.isArray(matches)) {
      return [{
        newInstance: (data as any).newInstance,
        matches
      }];
    }
    return [];
  }

  private normalizeMatches(matches: unknown): Instance[] {
    if (Array.isArray(matches)) {
      return matches
        .map(match => this.normalizeInstance(match))
        .filter((match): match is Instance => !!match);
    }
    const boxed = matches as any;
    if (boxed && Array.isArray(boxed.instances)) {
      return boxed.instances
        .map((match: any) => this.normalizeInstance(match))
        .filter((match: Instance | undefined): match is Instance => !!match);
    }
    if (boxed && Array.isArray(boxed.matches)) {
      return boxed.matches
        .map((match: any) => this.normalizeInstance(match))
        .filter((match: Instance | undefined): match is Instance => !!match);
    }
    return [];
  }

  private normalizeInstance(raw: any): Instance | undefined {
    if (!raw) {
      return undefined;
    }
    const candidate = raw.instance ?? raw.matchedInstance ?? raw.reactomeInstance ?? raw;
    if (!candidate) {
      return undefined;
    }

    const dbIdRaw = candidate.dbId ?? candidate.DB_ID ?? candidate.dbid;
    const dbId = dbIdRaw === undefined || dbIdRaw === null ? ('' as any) : Number(dbIdRaw);

    const schemaClassName = candidate.schemaClassName ?? candidate.className ?? candidate.schemaClass?.name ?? 'DatabaseObject';
    const displayName = this.normalizeDisplayName(candidate.displayName ?? candidate._displayName ?? candidate.name ?? candidate.attributes?.displayName);

    return {
      ...candidate,
      dbId,
      schemaClassName,
      displayName
    } as Instance;
  }

  private normalizeDisplayName(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === 'string') {
        return first;
      }
      if (first && typeof first.displayName === 'string') {
        return first.displayName;
      }
    }
    if (value && typeof value.displayName === 'string') {
      return value.displayName;
    }
    return '';
  }
}
