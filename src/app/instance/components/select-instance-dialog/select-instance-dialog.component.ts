import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {AttributeValue} from "../instance-view/instance-table/instance-table.model";
import {DataService} from "../../../core/services/data.service";
import {NewInstanceDialogComponent} from "../new-instance-dialog/new-instance-dialog.component";

@Component({
  selector: 'app-select-instance-dialog',
  templateUrl: './select-instance-dialog.component.html',
  styleUrls: ['./select-instance-dialog.component.scss']
})
export class SelectInstanceDialogComponent {

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
              public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
              private dataService: DataService) {
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    // this.dataService.registerNewInstance(this.instance!);
    // this.dialogRef.close(this.instance);
  }

}
