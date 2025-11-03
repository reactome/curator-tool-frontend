import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DeletedObjectCreationDialogComponent } from './deleted-object-creation-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class CreateDeletedDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(instances: Instance[]): MatDialogRef<DeletedObjectCreationDialogComponent, Instance> {
    const dialogRef = this.dialog.open(DeletedObjectCreationDialogComponent, {
      width: '1000px',
      height: '500px',
      data: { instances }
    });
    return dialogRef;
  }
}
