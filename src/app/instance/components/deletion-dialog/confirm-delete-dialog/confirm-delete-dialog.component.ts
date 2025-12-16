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

    this.dataService.getReferrers(this.instance!.dbId).subscribe(referrers => {
      let reviewStatusChnageInstances: Array<Instance> = new Array<Instance>();
      referrers.forEach(ref => {
        for (let inst of ref.referrers) {
          if (this.reviewStatusCheck.checkChangeReviewStatus(inst, ref.attributeName)) {
            reviewStatusChnageInstances.push(inst);
          };
        }
      let refInfo = {attributeName: ref.attributeName, instance: this.instance};
      this.dataService.setStructuralChangeOnDeletion(refInfo, reviewStatusChnageInstances.map(inst => inst.dbId));
      })
    })
  } 
}
