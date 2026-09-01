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
   * The stable URL of this referrer list, handled by ReferrersPageComponent. Deliberately
   * relative (no leading slash): a leading slash is resolved from the server root, bypassing
   * the <base href> the deployed site is served under (e.g. "/curatortool/") and opening this
   * link at the wrong, 404ing address in production.
   */
  get referrersUrl(): string {
    return `schema_view/referrers/${this.instance.dbId}`;
  }


  onCancel() {
    this.dialogRef.close();
  }
}
