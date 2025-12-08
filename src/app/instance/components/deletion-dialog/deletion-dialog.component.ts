import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance, Referrer, ReviewStatus } from 'src/app/core/models/reactome-instance.model';
import { ConfirmDeleteDialogService } from "./confirm-delete-dialog/confirm-delete-dialog.service";
import { DataService } from 'src/app/core/services/data.service';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './deletion-dialog.component.html',
  styleUrls: ['./deletion-dialog.component.scss']
})
export class DeletionDialogComponent {
  selected: string = '';
  showReferrersDialog: boolean = false;
  numberOfRefs: number = 0;
  instance2ReviewStatusChange: Array<Referrer> = new Array<Referrer>();

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
    public dialogRef: MatDialogRef<DeletionDialogComponent>,
    private confirmDeleteDialogService: ConfirmDeleteDialogService,
    private reviewStatusCheck: ReviewStatusCheck,
    private dataService: DataService) {
      this.isStructuralDeletion();
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.confirmDeleteDialogService.openDialog(this.instance);
    this.dialogRef.close(this.instance);
  }

  showReferrers() {
    this.showReferrersDialog = !this.showReferrersDialog;
  }

  setNumberOfRefs(refs: number) {
    this.numberOfRefs = refs;
  }

  isStructuralDeletion(): boolean {
    // Just adding logic to get referrers here. This will mean that referrers will be gotten every time an inst is marked for deletion.
  this.dataService.getReferrers(this.instance.dbId!).subscribe(referrers => {
      this.numberOfRefs = referrers.length;
      for (let ref of referrers) {
        if (this.reviewStatusCheck.checkChangeReviewStatus(this.instance, ref.attributeName)) {
          this.instance2ReviewStatusChange.push(ref);
        };
      }
    });
    console.log('isStructuralDeletion: ', this.instance2ReviewStatusChange);
    return this.instance2ReviewStatusChange.length > 0;
  }

}
