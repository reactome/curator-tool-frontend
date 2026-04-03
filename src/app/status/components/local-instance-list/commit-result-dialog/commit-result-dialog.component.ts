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

export interface CommitResult {
  displayName: string;
  dbId: number;
}

export interface CommitResultDialogData {
  title: string;
  results: CommitResult[];
}

@Component({
  selector: 'app-commit-result-dialog',
  templateUrl: './commit-result-dialog.component.html',
  styleUrls: ['./commit-result-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatTableModule, MatIconModule, MatTooltipModule]
})
export class CommitResultDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CommitResultDialogData,
    public dialogRef: MatDialogRef<CommitResultDialogComponent>
  ) {}

  onClose() {
    this.dialogRef.close();
  }

  openInstance(dbId: number) {
    window.open(`schema_view/instance/${dbId}`, '_blank');
  }
}
