import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ListInstancesDialogService } from './list-instances-dialog.service';

@Component({
  selector: 'app-list-instances-dialog',
  templateUrl: './list-instances-dialog.component.html',
  styleUrl: './list-instances-dialog.component.scss'
})
export class ListInstancesDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  selectedInstances: Instance[] = [];
  schemaClass: string = '';
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public schemaClassName: string,
    public dialogRef: MatDialogRef<ListInstancesDialogService>) {
    this.schemaClass = schemaClassName;
    this.selected = schemaClassName;
  }

  onSelectRow(row: Instance) {
    this.selectedInstances = [row];
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close(this.selectedInstances.at(0));
  }

  onRemoveEvent(instance: Instance) {
    let index = this.selectedInstances.indexOf(instance);
    this.selectedInstances.splice(index, 1);
    this.selectedInstances = [...this.selectedInstances];
  }

}
