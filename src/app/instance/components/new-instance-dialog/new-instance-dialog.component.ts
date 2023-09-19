import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
import { Store } from '@ngrx/store';
import { selectViewInstance } from '../../state/instance.selectors';

/**
 * A dialog component that is used to create a new Instance object.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './new-instance-dialog.component.html',
  styleUrls: ['./new-instance-dialog.component.scss']
})
export class NewInstanceDialogComponent implements OnInit {
  instance: Instance | undefined;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AttributeValue,
    public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
    private store: Store) { }

  ngOnInit(): void {
    // Get the view instance to be displayed here
    this.store.select(selectViewInstance()).subscribe(instance => {
      this.instance = instance;
    })
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    return this.instance;
  }

}
