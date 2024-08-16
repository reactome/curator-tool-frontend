import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './confirm-delete-dialog.component.html',
  styleUrls: ['./confirm-delete-dialog.component.scss']
})
export class ConfirmDeleteDialogComponent {
  selected: string = '';

  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<ConfirmDeleteDialogComponent>) {
  }


  onCancel() {
    this.dialogRef.close();
  }
}
