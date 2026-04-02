import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CommitResultDialogComponent, CommitResult } from './commit-result-dialog.component';

export { CommitResult } from './commit-result-dialog.component';

@Injectable({ providedIn: 'root' })
export class CommitResultDialogService {
  constructor(private dialog: MatDialog) {}

  openDialog(results: CommitResult[], title: string = 'Committed Instances'): void {
    this.dialog.open(CommitResultDialogComponent, {
      width: '500px',
      data: { title, results }
    });
  }
}
