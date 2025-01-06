import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ListInstancesDialogComponent } from './list-instances-dialog.component';


@Injectable({
  providedIn: 'root'
})
export class ListInstancesDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(data: { schemaClassName: string; title: string; }): MatDialogRef<ListInstancesDialogComponent, Instance> {
    const dialogRef = this.dialog.open(ListInstancesDialogComponent, {
      width: '1100px',
      height: '650px',
      data: data
    });
    return dialogRef;
  }
}
