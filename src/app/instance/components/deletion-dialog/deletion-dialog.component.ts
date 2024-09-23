import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DeleteInstanceActions, UpdateInstanceActions, NewInstanceActions} from "../../state/instance.actions";
import {Store} from "@ngrx/store";
import {ConfirmDeleteDialogComponent} from "./confirm-delete-dialog/confirm-delete-dialog.component";
import {ConfirmDeleteDialogService} from "./confirm-delete-dialog/confirm-delete-dialog.service";

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
  showReferrersDialog: boolean = false;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              private store: Store,
              public dialogRef: MatDialogRef<DeletionDialogComponent>,
              private confirmDeleteDialogService: ConfirmDeleteDialogService) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.confirmDeleteDialogService.openDialog(this.instance);
    this.dialogRef.close(this.instance);
  }

  showReferrers() {
    this.showReferrersDialog = !this.showReferrersDialog;
  }
}
