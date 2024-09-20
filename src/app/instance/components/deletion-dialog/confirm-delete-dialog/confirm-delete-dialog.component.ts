import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from "../../../../core/services/data.service";
import {Router} from "@angular/router";
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';

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
              public dialogRef: MatDialogRef<ConfirmDeleteDialogComponent>,
              public dataService: DataService,
              private store: Store) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onDelete() {
    this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instance)); 
    // In case this is a new instance or in the updated list
    this.store.dispatch(NewInstanceActions.remove_new_instance(this.instance));
    this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instance));
    this.dialogRef.close(this.instance);
    // this.router.navigate(["/schema_view"])
  }
}
