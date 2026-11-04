import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DiagramSyncDialogComponent } from './diagram-sync-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class DiagramSyncDialogService {

  constructor(private dialog: MatDialog) { }

  /**
   * Open the Diagram sync QA report for a Pathway. The dialog runs the check itself, so it can
   * show its own loading and error states and re-run the check.
   */
  openDialog(pathway: Instance): MatDialogRef<DiagramSyncDialogComponent> {
    return this.dialog.open(DiagramSyncDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      data: { pathway },
    });
  }
}
