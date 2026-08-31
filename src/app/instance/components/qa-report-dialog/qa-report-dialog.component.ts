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
  qaReportPassed: boolean = true;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: { instance: Instance; report?: QAReport },
              public dialogRef: MatDialogRef<QAReportDialogComponent, boolean | string>,
              private dataService: DataService) {

      // Initialize qaReport as an empty object to avoid undefined errors in the template
      this.qaReport = { instance: data.instance } as QAReport;

      if (data.report) {
        // A pre-built report was supplied (e.g. a client-side diagram content check) --
        // use it directly instead of fetching the server-side QA report.
        this.applyReport(data.report);
        return;
      }

      // Fetch the actual report asynchronously
      this.dataService.fetchQAReport(data.instance).subscribe(report => this.applyReport(report));
  }

  private applyReport(report: QAReport) {
    this.qaReport = report; // This assignment will update the value and Angular will update the view

    this.qaReportPassed = true;

    if (!this.qaReport || !Array.isArray(this.qaReport.qaResults) || this.qaReport.qaResults.length === 0) {
      return;
    }

    for (let check of this.qaReport.qaResults) {
      if (!check.passed) {
        this.qaReportPassed = false;
        return;
      }
    }
  }

  onCancel() {
    this.dialogRef.close(this.qaReportPassed);
  }

  onAutoFix() {
    this.dialogRef.close('autofix');
  }
}
