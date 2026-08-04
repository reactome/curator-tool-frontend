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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Instance, MatchResolution, MatchResolutionAction } from 'src/app/core/models/reactome-instance.model';
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

/** What the user has chosen to do with a matched new instance. 'none' = leave uncommitted. */
type GroupAction = 'none' | MatchResolutionAction;

/**
 * Dialog shown when one or more new instances being committed have matching
 * instances already in the database. For each new instance the user picks an
 * action: use one of the existing matches instead (the default), merge it into
 * a match, commit it as a new instance anyway, or leave it uncommitted.
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
    MatFormFieldModule,
    MatSelectModule,
    ListInstancesModule,
  ]
})

export class MatchedInstancesDialogComponent {
  readonly groups: MatchedNewInstanceGroup[];
  /** The matched rows only offer the "open in new tab" action; the resolution is picked via the dropdown. */
  actionButtons: ActionButton[] = [ACTION_BUTTONS.LAUNCH];
  /**
   * The selectable actions shown in each instance's dropdown, in display order.
   * The first entry is the default for every group (see DEFAULT_ACTION).
   */
  readonly actionOptions: { value: GroupAction; label: string }[] = [
    { value: 'use-existing', label: 'Use a DB instance instead' },
    { value: 'merge', label: 'Merge into a DB instance' },
    { value: 'commit-anyway', label: 'Commit as a new instance' },
    { value: 'none', label: 'Do Nothing' },
  ];
  /** The action pre-selected for every group, and the initial value of the "apply to all" dropdown. */
  readonly DEFAULT_ACTION: GroupAction = this.actionOptions[0].value;
  /** The action the "apply to all" control will push onto every group. */
  bulkAction: GroupAction = this.DEFAULT_ACTION;
  /** Indices of the groups whose matches table is currently expanded. */
  private readonly expanded = new Set<number>();
  /** Group index -> chosen action. Absent means the default action. */
  private readonly actions = new Map<number, GroupAction>();
  /** Group index -> dbId of the chosen existing match (for 'use-existing' / 'merge'). */
  private readonly targets = new Map<number, number>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchedInstancesDialogData,
    public dialogRef: MatDialogRef<MatchedInstancesDialogComponent, MatchResolution[]>,
    private router: Router
  ) {
    this.groups = this.normalizeGroups(this.extractGroups(data));
    // Every group starts on the default action, targeting its first match, so the
    // common case (the new instance really is the existing one) needs no clicks.
    this.groups.forEach((_, index) => this.applyDefaultTarget(index));
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

  /** The action currently chosen for a group; every group is seeded in the constructor. */
  getAction(index: number): GroupAction {
    return this.actions.get(index) ?? 'none';
  }

  /**
   * Record the action for one group. `expand` is suppressed by "apply to all" so a
   * bulk choice does not blow every matches table open at once.
   */
  setAction(index: number, action: GroupAction, expand = true): void {
    this.actions.set(index, action);
    if (action === 'use-existing' || action === 'merge') {
      // Default the target to the first match so the choice is never empty.
      if (!this.targets.has(index)) {
        const firstDbId = this.firstMatchDbId(index);
        if (firstDbId !== undefined) {
          this.targets.set(index, firstDbId);
        }
      }
      if (expand) {
        this.expanded.add(index);
      }
    }
  }

  /** Push the action picked in the "apply to all" dropdown onto every group. */
  applyToAll(): void {
    this.groups.forEach((_, index) => this.setAction(index, this.bulkAction, false));
  }

  /**
   * Seed a group with the default action, targeting its first match. A group with no
   * usable match falls back to 'none' so it is not reported as resolved.
   */
  private applyDefaultTarget(index: number): void {
    const firstDbId = this.firstMatchDbId(index);
    if (firstDbId === undefined) {
      this.actions.set(index, 'none');
      return;
    }
    this.actions.set(index, this.DEFAULT_ACTION);
    this.targets.set(index, firstDbId);
  }

  /** dbId of a group's first match, or undefined when it has none / it is unusable. */
  private firstMatchDbId(index: number): number | undefined {
    const dbId = this.groups[index]?.matches?.[0]?.dbId;
    if (dbId === undefined || dbId === null || (dbId as any) === '') {
      return undefined;
    }
    return dbId;
  }

  /** True when the chosen action needs a target existing instance. */
  needsTarget(index: number): boolean {
    const action = this.getAction(index);
    return action === 'use-existing' || action === 'merge';
  }

  getTarget(index: number): number | undefined {
    return this.targets.get(index);
  }

  setTarget(index: number, dbId: number): void {
    this.targets.set(index, dbId);
  }

  /** True if any group has an actionable choice (i.e. not "leave uncommitted"). */
  get hasSelection(): boolean {
    return this.groups.some((_, index) => this.getAction(index) !== 'none');
  }

  onClose(): void {
    this.dialogRef.close([]);
  }

  onApply(): void {
    const resolutions: MatchResolution[] = [];
    this.groups.forEach((group, index) => {
      const newInstanceDbId = group.newInstance?.dbId;
      if (newInstanceDbId === undefined || newInstanceDbId === null) {
        return;
      }
      const action = this.getAction(index);
      if (action === 'commit-anyway') {
        resolutions.push({ newInstanceDbId, action });
      } else if (action === 'use-existing' || action === 'merge') {
        const existingInstanceDbId = this.getTarget(index);
        if (existingInstanceDbId !== undefined) {
          resolutions.push({ newInstanceDbId, action, existingInstanceDbId });
        }
      }
      // 'none' -> leave the new instance uncommitted (emit nothing).
    });
    this.dialogRef.close(resolutions);
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

  /** Handle action-button clicks emitted by the shared instance list table (open only). */
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
