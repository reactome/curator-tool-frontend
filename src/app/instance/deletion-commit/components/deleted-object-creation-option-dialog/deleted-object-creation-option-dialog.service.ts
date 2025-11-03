import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DeletedObjectCreationOptionDialogComponent } from './deleted-object-creation-option-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class CommitDeletedDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(): MatDialogRef<DeletedObjectCreationOptionDialogComponent, Boolean> {
    const dialogRef = this.dialog.open(DeletedObjectCreationOptionDialogComponent, {
      width: '1000px',
      height: '200px',
    });
    return dialogRef;
  }

  
}