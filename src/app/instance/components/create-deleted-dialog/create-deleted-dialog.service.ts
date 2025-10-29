import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
import { CreateDeletedDialogComponent } from './create-deleted-dialog.component';

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class CreateDeletedDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(): MatDialogRef<CreateDeletedDialogComponent, Instance> {
    const dialogRef = this.dialog.open(CreateDeletedDialogComponent, {
      width: '1000px',
      height: '500px',
    });
    return dialogRef;
  }
}
