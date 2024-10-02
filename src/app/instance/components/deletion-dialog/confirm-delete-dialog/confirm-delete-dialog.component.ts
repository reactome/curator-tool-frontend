import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from "../../../../core/services/data.service";
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';

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
              private instUtil: InstanceUtilities,
              private store: Store) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onDelete() {
    if (this.instance.dbId >= 0) {
      this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instUtil.makeShell(this.instance))); 
      // Make sure it is removed from the updated list if it is.
      if (this.instance.modifiedAttributes && this.instance.modifiedAttributes.length > 0)
        this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instUtil.makeShell(this.instance)));
    }
    else {
      this.store.dispatch(NewInstanceActions.remove_new_instance(this.instUtil.makeShell(this.instance)));
      this.instUtil.setDeletedDbId(this.instance.dbId); // Commit right away
    }
    this.dialogRef.close(this.instance);
    // this.router.navigate(["/schema_view"])
  }
}
