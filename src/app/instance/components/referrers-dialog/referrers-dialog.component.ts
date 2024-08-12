import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance, InstanceList, Referrer} from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
import { Store } from '@ngrx/store';
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import {ViewOnlyService} from "../../../core/services/view-only.service";

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
