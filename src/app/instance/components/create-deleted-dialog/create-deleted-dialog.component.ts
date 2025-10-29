import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
import { Store } from '@ngrx/store';
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { concatMap, from, Observable } from 'rxjs';
import { Pipe } from '@angular/core';

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-create-deleted-dialog',
  templateUrl: './create-deleted-dialog.component.html',
  styleUrls: ['./create-deleted-dialog.component.scss']
})
export class CreateDeletedDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  instance: Instance | undefined;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) 
              public dialogRef: MatDialogRef<CreateDeletedDialogComponent>,
              private dataService: DataService,
              private store: Store) {
    // initialize candidate classes and selected value, then create the initial instance
        this.selected = "Deleted"
        this.dataService.createNewInstance(this.selected).subscribe((instance: Instance) => this.instance = instance);
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
    this.dataService.createNewInstance(this.selected).subscribe(instance => {
        this.instance = instance;
      }
    );
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    if (this.instance) {
      this.dataService.registerInstance(this.instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instance));
    }
    this.dialogRef.close(this.instance);
  }
}