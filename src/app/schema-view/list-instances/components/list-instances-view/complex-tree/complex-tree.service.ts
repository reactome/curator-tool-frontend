import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ComplexTreeComponent } from './complex-tree.component';

@Injectable({
  providedIn: 'root'
})
export class ComplexTreeService {

  constructor(private dialog: MatDialog) { }

  openDialog(dbId: number): MatDialogRef<ComplexTreeComponent> {
    const dialogRef = this.dialog.open(ComplexTreeComponent, {
      width: '700px',
      // height: '600px',
      data: dbId
    });
    return dialogRef;
  }
}
