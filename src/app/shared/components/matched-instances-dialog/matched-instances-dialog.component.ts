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
}

/**
 * Review-only dialog shown when one or more new instances being committed have
 * matching instances already in the database. These new instances are not committed;
 * this dialog lets the user review the matches for each of them.
 */
@Component({
  selector: 'app-matched-instances-dialog',
  templateUrl: './matched-instances-dialog.component.html',
  styleUrls: ['./matched-instances-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatTableModule, MatIconModule, MatTooltipModule]
})
export class MatchedInstancesDialogComponent {
  displayedColumns: string[] = ['dbId', 'displayName', 'launch'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchedInstancesDialogData,
    public dialogRef: MatDialogRef<MatchedInstancesDialogComponent>
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  openInstance(dbId: number): void {
    window.open(`schema_view/instance/${dbId}`, '_blank');
  }
}
