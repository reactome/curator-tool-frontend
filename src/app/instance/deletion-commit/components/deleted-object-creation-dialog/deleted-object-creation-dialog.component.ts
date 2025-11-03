import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-deleted-object-creation-dialog',
  templateUrl: './deleted-object-creation-dialog.component.html',
  styleUrls: ['./deleted-object-creation-dialog.component.scss']
})
export class DeletedObjectCreationDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  instance: Instance | undefined;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instances: Array<Instance>,
    private dialogRef: MatDialogRef<DeletedObjectCreationDialogComponent>,
    private dataService: DataService,) {
    // initialize candidate classes and selected value, then create the initial instance
    this.selected = "Deleted"
    this.dataService.createNewInstance(this.selected).subscribe((deletedInstance: Instance) => {
      if (deletedInstance.attributes === undefined) {
        deletedInstance.attributes = new Map<string, any>();
      }
      // Ensure the injected data is treated as an array; MAT_DIALOG_DATA may provide an object with an instances property
      const instArray: Instance[] = Array.isArray(this.instances) ? this.instances : (this.instances && (this.instances as any).instances) ? (this.instances as any).instances : [];
      deletedInstance.attributes.set('deletedInstanceDbId', instArray.map(inst => inst.dbId).sort((a, b) => a - b));
      this.instance = deletedInstance;
    })
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close(this.instance);
  }
}