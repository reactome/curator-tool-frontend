import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatchedInstancesDialogComponent, MatchedInstancesDialogData } from './matched-instances-dialog.component';

@Injectable({ providedIn: 'root' })
export class MatchedInstancesDialogService {
  constructor(private dialog: MatDialog) {}

  openDialog(data: MatchedInstancesDialogData): MatDialogRef<MatchedInstancesDialogComponent> {
    return this.dialog.open(MatchedInstancesDialogComponent, {
      width: '1100px',
      maxHeight: '80vh',
      data
    });
  }
}
