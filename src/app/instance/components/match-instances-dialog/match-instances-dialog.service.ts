import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { MatchInstancesDialogComponent, MatchInstancesDialogData } from './match-instances-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class MatchInstancesDialogService {
  constructor(private dialog: MatDialog) {}

  openDialog(data: MatchInstancesDialogData): MatDialogRef<MatchInstancesDialogComponent, Instance> {
    return this.dialog.open(MatchInstancesDialogComponent, {
      width: '1100px',
      height: '650px',
      data
    });
  }
}
