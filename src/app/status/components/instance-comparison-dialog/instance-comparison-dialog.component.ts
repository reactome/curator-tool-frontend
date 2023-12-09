import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from 'src/app/core/services/data.service';
import {SchemaClass} from "../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './instance-comparison-dialog.component.html',
  styleUrls: ['./instance-comparison-dialog.component.scss']
})
export class CompareUpdatedInstanceDialog {
  // instance: Instance | undefined;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<CompareUpdatedInstanceDialog>,
              private dataService: DataService) {
  }


  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    this.dataService.registerNewInstance(this.instance!);
    this.dialogRef.close(this.instance);
  }
}
