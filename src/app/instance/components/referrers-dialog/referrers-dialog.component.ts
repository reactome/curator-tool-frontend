import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './referrers-dialog.component.html',
  styleUrls: ['./referrers-dialog.component.scss']
})
export class ReferrersDialogComponent {
  selected: string = '';

  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<ReferrersDialogComponent>) {
  }


  onCancel() {
    this.dialogRef.close();
  }
}
