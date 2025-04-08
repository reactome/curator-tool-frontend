import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QAReport, QAResults } from 'src/app/core/models/qa-report.model';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

/**
 * A dialog component for displaying qa-report.
 */
@Component({
  selector: 'qa-report-dialog',
  templateUrl: './qa-report-dialog.component.html',
  styleUrls: ['./qa-report-dialog.component.scss']
})
export class QAReportDialogComponent {
  qaReport: QAReport | undefined; 

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<QAReportDialogComponent>,
              private dataService: DataService) {


      this.dataService.fetchQAReport(instance).subscribe(report => {
        this.qaReport = report;
      })
  }


  onCancel() {
    this.dialogRef.close();
  }
}
