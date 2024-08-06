import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DeleteInstanceActions, InstanceActions} from "../../state/instance.actions";
import {Store} from "@ngrx/store";

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './deletion-dialog.component.html',
  styleUrls: ['./deletion-dialog.component.scss']
})
export class DeletionDialogComponent {
  selected: string = '';

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              private store: Store,
              public dialogRef: MatDialogRef<DeletionDialogComponent>) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instance));
    this.dialogRef.close(this.instance);
  }
}
