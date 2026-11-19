import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AttributeDataType } from 'src/app/core/models/reactome-schema.model';
import {
  DatabaseMergeChoice,
  DatabaseMergeData,
  DatabaseMergeRow,
  DatabaseMergeService
} from 'src/app/core/services/database-merge.service';

export interface MergeWithDatabaseDialogData {
  merge: DatabaseMergeData;
  /** Set when the dialog was opened because a commit was rejected, to explain why it appeared. */
  reason?: string;
}

/**
 * Lets the curator reconcile a staged copy with the database copy that changed under it. Rows
 * are only the attributes that differ. Each defaults to the curator's value when they edited it
 * and to the database value otherwise (see DatabaseMergeService). Closing with true means "apply";
 * the rows' choices are read by the caller from the same data object.
 */
@Component({
  selector: 'app-merge-with-database-dialog',
  templateUrl: './merge-with-database-dialog.component.html',
  styleUrls: ['./merge-with-database-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatTooltipModule,
  ]
})
export class MergeWithDatabaseDialogComponent {
  readonly rows: DatabaseMergeRow[];

  constructor(@Inject(MAT_DIALOG_DATA) public data: MergeWithDatabaseDialogData,
    public dialogRef: MatDialogRef<MergeWithDatabaseDialogComponent, boolean>,
    private mergeService: DatabaseMergeService) {
    this.rows = data.merge.rows;
  }

  get instanceLabel(): string {
    const local = this.data.merge.local;
    return `${local.schemaClassName}: ${local.displayName ?? ''} [${local.dbId}]`;
  }

  /** Attributes both sides changed: the ones the curator really has to look at. */
  get editedCount(): number {
    return this.rows.filter(row => row.editedLocally).length;
  }

  setAll(choice: 'local' | 'database'): void {
    this.rows.forEach(row => row.choice = choice);
  }

  resetDefaults(): void {
    this.rows.forEach(row => row.choice = row.editedLocally ? 'local' : 'database');
  }

  choose(row: DatabaseMergeRow, choice: DatabaseMergeChoice): void {
    row.choice = choice;
  }

  /** What the attribute will hold after the merge, shown under the row. */
  resultLabel(row: DatabaseMergeRow): string {
    const values = this.mergeService.mergedValues(row);
    return values.length === 0 ? '(empty)' : values.map(value => this.label(row, value)).join(', ');
  }

  label(row: DatabaseMergeRow, value: any): string {
    if (value === undefined || value === null)
      return '';
    if (row.attribute.type === AttributeDataType.INSTANCE || (typeof value === 'object' && 'dbId' in value))
      return `${value.displayName ?? '(no name)'} [${value.dbId}]`;
    if (row.attribute.type === AttributeDataType.BOOLEAN)
      return value ? 'true' : 'false';
    return String(value);
  }

  apply(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
