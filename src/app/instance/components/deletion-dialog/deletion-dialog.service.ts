import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {DeletionDialogComponent} from './deletion-dialog.component';
import {Instance} from 'src/app/core/models/reactome-instance.model';

/**
 * Use a dialog service to hide the actual implementation of this dialog component from
 * other components using this dialog.
 * Note: This should be considered a good design though we may open the dialog for NewInstanceDialogComponent
 * directly in other places.
 */
@Injectable({
  providedIn: 'root'
})
export class DeletionDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(instance: Instance): MatDialogRef<DeletionDialogComponent, Instance> {
    return this.dialog.open(DeletionDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: instance,
    });
  }
}
