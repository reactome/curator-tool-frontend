import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NewInstanceDialogComponent, NewInstanceDialogResult } from './new-instance-dialog.component';
import { AttributeValue } from 'src/app/core/models/reactome-instance.model';

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

  openDialog(attributeValue: AttributeValue): MatDialogRef<NewInstanceDialogComponent, NewInstanceDialogResult> {
    const dialogRef = this.dialog.open(NewInstanceDialogComponent, {
      width: '1000px',
      height: '500px',
      data: attributeValue
    });
    return dialogRef;
  }
}
