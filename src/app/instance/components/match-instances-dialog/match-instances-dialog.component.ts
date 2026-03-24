import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export interface MatchInstancesDialogData {
  title: string;
  instances: Instance[];
}

@Component({
  selector: 'app-match-instances-dialog',
  templateUrl: './match-instances-dialog.component.html',
  styleUrls: ['./match-instances-dialog.component.scss']
})
export class MatchInstancesDialogComponent {
  selectedInstance: Instance | undefined;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchInstancesDialogData,
    private dialogRef: MatDialogRef<MatchInstancesDialogComponent, Instance>
  ) {}

  onSelectRow(row: Instance): void {
    this.selectedInstance = row;
  }

  onOK(): void {
    this.dialogRef.close(this.selectedInstance);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
