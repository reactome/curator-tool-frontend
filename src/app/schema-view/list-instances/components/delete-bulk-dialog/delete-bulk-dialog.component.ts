import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from "../../../../core/services/data.service";
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from '../list-instances-view/table/instance-list-table/instance-list-table.component';

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-delete-bulk-dialog',
  templateUrl: './delete-bulk-dialog.component.html',
  styleUrls: ['./delete-bulk-dialog.component.scss']
})
export class DeleteBulkDialogComponent {
  selected: string = '';
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.CLOSE];


  constructor(@Inject(MAT_DIALOG_DATA) public instances: Instance[],
    public dialogRef: MatDialogRef<DeleteBulkDialogComponent>,
    public dataService: DataService,
    private instUtil: InstanceUtilities,
    private store: Store) {
  }

  handleAction(actionEvent: { instance: Instance, action: string }) {
    switch (actionEvent.action) {
      case ACTION_BUTTONS.CLOSE.name: {
        // Remove the instance from this.instances
        this.instances = [...this.instances.filter(inst => inst.dbId !== actionEvent.instance.dbId)];
        if (this.instances.length === 0) {
          this.dialogRef.close();
        }
        break;
      }
    }
  }


  onCancel() {
    this.dialogRef.close();
  }

  onDelete() {
    for (let instance of this.instances) {
      if (instance.dbId >= 0) {
        this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instUtil.makeShell(instance)));
        // Make sure it is removed from the updated list if it is.
        if (instance.modifiedAttributes && instance.modifiedAttributes.length > 0)
          this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instUtil.makeShell(instance)));
      }
      else {
        this.store.dispatch(NewInstanceActions.remove_new_instance(this.instUtil.makeShell(instance)));
        this.instUtil.setDeletedDbId(instance.dbId); // Commit right away
      }
    }

    this.dialogRef.close(this.instances);
    //this.router.navigate(["/schema_view"]);
  }
}
