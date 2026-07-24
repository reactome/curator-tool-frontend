import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

/**
 * Data passed to the stoichiometry dialog: the value being edited and how many
 * copies of it currently exist in the attribute.
 */
export interface StoichiometryDialogData {
  displayName: string;
  currentCount: number;
}

/**
 * A small dialog to set the stoichiometry (number of copies) of an existing
 * instance value on a stoichiometry relationship type. Returns the new total
 * count, or undefined if cancelled.
 */
@Component({
  selector: 'app-stoichiometry-dialog',
  templateUrl: './stoichiometry-dialog.component.html',
  styleUrls: ['./stoichiometry-dialog.component.scss']
})
export class StoichiometryDialogComponent {
  count: number;

  constructor(
    public dialogRef: MatDialogRef<StoichiometryDialogComponent, number>,
    @Inject(MAT_DIALOG_DATA) public data: StoichiometryDialogData
  ) {
    this.count = data.currentCount;
  }

  onOK(): void {
    this.dialogRef.close(Math.max(1, Math.floor(this.count) || 1));
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
