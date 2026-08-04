import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from "../../../../core/services/data.service";
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';

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
    private store: Store,
    private reviewStatusCheck: ReviewStatusCheck,
  ) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onDelete() {
    if (this.instance.dbId >= 0) {
      // Staging only: referrers still validly point at this instance in the database
      // until the deletion is actually committed, so DeletedInstanceAttributeFilter's
      // passive, display-only filtering (driven by the deleteInstances store slice) is
      // enough here. No need to actively mutate referrers or cached instances yet.
      this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instUtil.makeShell(this.instance)));
      // Make sure it is removed from the updated list if it is.
      if (this.instance.modifiedAttributes && this.instance.modifiedAttributes.length > 0)
        this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instUtil.makeShell(this.instance)));
    }
    else {
      // A new instance's deletion is applied immediately (there's no staged phase for
      // it), so referrers need to be actively repaired right away.
      this.store.dispatch(NewInstanceActions.remove_new_instance(this.instance));
      this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(this.instUtil.makeShell(this.instance)));
      this.dataService.synchronizeDeletedReferrers([this.instance]).subscribe();
    }
    this.dialogRef.close(this.instance);
    // this.router.navigate(["/schema_view"])
  } 
}
