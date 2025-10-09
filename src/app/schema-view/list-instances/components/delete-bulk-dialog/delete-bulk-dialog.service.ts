import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {DeleteBulkDialogComponent} from "./delete-bulk-dialog.component";
import {Instance} from 'src/app/core/models/reactome-instance.model';
import { Action } from 'rxjs/internal/scheduler/Action';
// Update the import path below to the correct relative path if needed
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from '../list-instances-view/table/instance-list-table/instance-list-table.component';


@Injectable({
  providedIn: 'root'
})
export class DeleteBulkDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(instances: Instance[]): MatDialogRef<DeleteBulkDialogComponent, Instance[]> {
    return this.dialog.open(DeleteBulkDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: instances,
    });
  }
}
