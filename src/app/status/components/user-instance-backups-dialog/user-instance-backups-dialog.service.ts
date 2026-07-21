import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserInstanceBackupsDialogComponent } from './user-instance-backups-dialog.component';

@Injectable({ providedIn: 'root' })
export class UserInstanceBackupsDialogService {
  constructor(private dialog: MatDialog) {
  }

  openDialog(): void {
    this.dialog.open(UserInstanceBackupsDialogComponent, {
      width: '600px'
    });
  }
}
