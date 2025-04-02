import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { QAReportDialogComponent } from './qa-report-dialog.component';
import { Instance } from 'src/app/core/models/reactome-instance.model';

@Injectable({
  providedIn: 'root'
})
export class QAReportDialogService {

  constructor(private dialog: MatDialog) { }

  openDialog(instance: Instance): MatDialogRef<QAReportDialogComponent, Instance> {
    return this.dialog.open(QAReportDialogComponent, {
      width: '1000px',
      // height: '900px',
      data: instance,
    });
  }
}
