import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
// import { DataService } from 'src/app/core/services/data.service';
// import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
// import { NewInstanceActions } from "src/app/schema-view/instance/state/instance.actions";

/**
 * A dialog component that is used to create a new Instance object.
 */
@Component({
  selector: 'qa-report-dialog',
  templateUrl: './qa-report-dialog.component.html',
  styleUrls: ['./qa-report-dialog.component.scss']
})
export class QAReportDialogComponent {
  qaReportName: string = "";
  qaReport: string[][] = [];

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA)
              public data: Map<string, string[][]>,
              public dialogRef: MatDialogRef<QAReportDialogComponent>) {
          this.qaReportName = Array.from(data.keys())[0];
          this.qaReport = data.get(this.qaReportName)!;
  }

  onOK() {
    this.dialogRef.close("test return value from closing dialog: OK");
  }
}
