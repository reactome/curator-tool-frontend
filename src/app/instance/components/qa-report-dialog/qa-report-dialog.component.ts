import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QAReport, QACheck } from 'src/app/core/models/qa-report.model';
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

      // const speciesTest: QATest = {
      //   testName: 'Species Check',
      //   testPassed: false,
      //   testAttributes: [{issueName:'Mismatched Species Type', issueDetails: 'Mus Muscous'}]
      // }
  
      // const compartmentTest: QATest = {
      //   testName: 'Compartment Check',
      //   testPassed: false,
      //   testAttributes: [{issueName:'Multiple Compartments', issueDetails: 'List comparments'}]
      // }

      // const REPORT_DATA: QAReport = {
      //   instance: this.instance!, 
      //   testsRun: [speciesTest, compartmentTest], 
      // }

     // this.qaReport = REPORT_DATA;


      this.dataService.fetchQAReport(instance).subscribe(report => {
        this.qaReport = report;
      })
  }


  onCancel() {
    this.dialogRef.close();
  }
}
