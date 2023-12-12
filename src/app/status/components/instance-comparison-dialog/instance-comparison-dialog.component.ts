// Switch to use the center of the app to do comparison so that links in the tables can be openeded directly there.
// Otherwise, it is difficult to handle the links in table.

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './instance-comparison-dialog.component.html',
  styleUrls: ['./instance-comparison-dialog.component.scss']
})
export class InstanceComparisonDialog {
  // instance: Instance | undefined;
  displayedColumns: string[] = ['name', 'value', 'referenceValue'];
  dbInstance?: Instance;
  updatedInstance?: Instance;
  testDbId: number = 389891;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public dbId: number,
              public dialogRef: MatDialogRef<InstanceComparisonDialog>,
              private dataService: DataService) {
    this.dataService.fetchInstance(this.dbId).subscribe(instance => this.updatedInstance = instance);
    // Need the original database copy. Not the cached one.
    this.dataService.fetchInstanceFromDatabase(this.dbId, false).subscribe(instance => this.dbInstance = instance);
  }

  //TODO: The following two functions to be updated.
  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close();
  }
}
