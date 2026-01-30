import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { BatchEditDialogComponent } from "./batch-edit-dialog.component";

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class BatchEditDialogService {

  constructor(private dialog: MatDialog) {

  }

  openDialog(data: Instance[]): MatDialogRef<BatchEditDialogComponent, Instance[]> {
    const dialogRef = this.dialog.open(BatchEditDialogComponent, {
      width: '1200px',
      height: '700px',
      data: data
    });
    return dialogRef;
  }
}