import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { Instance } from 'src/app/core/models/reactome-instance.model';

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
  imports: [CommonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatTableModule, MatIconModule, MatTooltipModule]
})
export class MatchedInstancesDialogComponent {
  readonly groups: MatchedNewInstanceGroup[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchedInstancesDialogData,
    public dialogRef: MatDialogRef<MatchedInstancesDialogComponent, boolean>
  ) {
    this.groups = this.normalizeGroups(this.extractGroups(data));
    console.debug('[MatchedInstancesDialog] groups:', this.groups.length,
      'matchCounts:', this.groups.map(group => this.getMatchedRows(group).length));
  }

  onClose(): void {
    this.dialogRef.close(false);
  }

  onCommitAnyway(): void {
    this.dialogRef.close(true);
  }

  getNewInstanceRows(group: MatchedNewInstanceGroup): Instance[] {
    if (!group?.newInstance || group.newInstance.dbId === undefined || group.newInstance.dbId === null) {
      return [];
    }
    return [group.newInstance];
  }

  getMatchedRows(group: MatchedNewInstanceGroup): Instance[] {
    return this.normalizeMatches((group as any)?.matches);
  }

  openInstance(dbId: number): void {
    if (dbId === undefined || dbId === null) {
      return;
    }
    window.open(`schema_view/instance/${dbId}`, '_blank');
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
