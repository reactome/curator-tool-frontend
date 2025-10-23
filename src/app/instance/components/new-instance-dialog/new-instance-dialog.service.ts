import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class NewInstanceDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(attributeValue: AttributeValue): MatDialogRef<NewInstanceDialogComponent, Instance> {
    const dialogRef = this.dialog.open(NewInstanceDialogComponent, {
      width: '1000px',
      height: '500px',
      data: attributeValue
    });
    return dialogRef;
  }
}
