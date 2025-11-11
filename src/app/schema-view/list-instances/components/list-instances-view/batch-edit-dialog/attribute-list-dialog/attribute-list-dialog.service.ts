import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AttributeListDialogComponent } from './attribute-list-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from 'src/app/instance/components/instance-view/instance-table/instance-table.model';

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class AttributeListDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(data: any[]): MatDialogRef<AttributeListDialogComponent, any[]> {
    const dialogRef = this.dialog.open(AttributeListDialogComponent, {
      width: '1100px',
      height: '500px',
      data: data
    });
    return dialogRef;
  }
}