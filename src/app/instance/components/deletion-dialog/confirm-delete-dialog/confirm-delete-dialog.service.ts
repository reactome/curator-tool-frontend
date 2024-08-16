import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {ConfirmDeleteDialogComponent} from './confirm-delete-dialog.component';
import {Instance} from 'src/app/core/models/reactome-instance.model';


@Injectable({
  providedIn: 'root'
})
export class ConfirmDeleteDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(instance: Instance): MatDialogRef<ConfirmDeleteDialogComponent, Instance> {
    return this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: instance,
    });
  }
}
