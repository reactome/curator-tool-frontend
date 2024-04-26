import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { QAReportDialogComponent } from './qa-report-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';

@Injectable({
  providedIn: 'root'
})
export class QAReportDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(qaReportName: string, qaReport: string[][]): MatDialogRef<QAReportDialogComponent> {
    const dialogRef = this.dialog.open(QAReportDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: new Map<string, string[][]>([
        [qaReportName, qaReport]
        ])
    });
    return dialogRef;
  }
}
