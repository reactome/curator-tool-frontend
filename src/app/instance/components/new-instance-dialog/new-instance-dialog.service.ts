import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';

@Injectable({
  providedIn: 'root'
})
export class NewInstanceDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(attributeValue: AttributeValue): MatDialogRef<NewInstanceDialogComponent, Instance> {
    const dialogRef = this.dialog.open(NewInstanceDialogComponent, {
      width: '600px',
      height: '900px',
      data: attributeValue
    });
    return dialogRef;
  }
}
