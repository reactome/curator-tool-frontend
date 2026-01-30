import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import {SelectInstanceDialogComponent} from "./select-instance-dialog.component";
import { AttributeValue } from 'src/app/instance/components/instance-view/instance-table/instance-table-comparison.model';

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class SelectInstanceDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(attributeValue: AttributeValue): MatDialogRef<SelectInstanceDialogComponent, Instance[]> {
    const dialogRef = this.dialog.open(SelectInstanceDialogComponent, {
      width: '1100px',
      height: '900px',
      data: attributeValue
    });
    return dialogRef;
  }
}
