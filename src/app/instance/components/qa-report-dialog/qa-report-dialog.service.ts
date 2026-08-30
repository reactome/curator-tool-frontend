import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { QAReportDialogComponent } from './qa-report-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { QAReport } from 'src/app/core/models/qa-report.model';

@Injectable({
  providedIn: 'root'
})
export class QAReportDialogService {

  constructor(private dialog: MatDialog) { }

  /**
   * @param report Optional pre-built report (e.g. from a client-side check). When
   * supplied, the dialog skips its own server-side fetchQAReport call and renders
   * this report directly.
   */
  openDialog(instance: Instance, report?: QAReport): MatDialogRef<QAReportDialogComponent, boolean | string> {
    return this.dialog.open(QAReportDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: { instance, report },
    });
  }
}
