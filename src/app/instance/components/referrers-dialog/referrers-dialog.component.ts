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

  /**
   * The stable URL of this referrer list, handled by ReferrersPageComponent. Absolute so it
   * resolves the same regardless of the instance the dialog was opened from.
   */
  get referrersUrl(): string {
    return `/schema_view/instance/${this.instance.dbId}/referrers`;
  }


  onCancel() {
    this.dialogRef.close();
  }
}
