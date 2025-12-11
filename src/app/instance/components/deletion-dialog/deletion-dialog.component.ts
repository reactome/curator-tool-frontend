import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance, Referrer, ReviewStatus } from 'src/app/core/models/reactome-instance.model';
import { ConfirmDeleteDialogService } from "./confirm-delete-dialog/confirm-delete-dialog.service";
import { DataService } from 'src/app/core/services/data.service';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { CLASSES_AFFECTING_STRUCTURE } from 'src/app/core/models/reactome-schema.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';

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

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
    public dialogRef: MatDialogRef<DeletionDialogComponent>,
    private confirmDeleteDialogService: ConfirmDeleteDialogService,
    private dataService: DataService,
    private instUtils: InstanceUtilities,) {
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

  isStructuralChange(): boolean {
    let structuralClasses = CLASSES_AFFECTING_STRUCTURE
    for(let cls of structuralClasses) {
      if (this.instUtils.isSchemaClass(this.instance, cls, this.dataService)) {
        return true;
      }
    }
    return false;
  }

}
