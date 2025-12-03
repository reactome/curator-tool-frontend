import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ListInstancesDialogService } from './list-instances-dialog.service';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import combine from 'vectorious/dist/core/combine';

@Component({
  selector: 'app-list-instances-dialog',
  templateUrl: './list-instances-dialog.component.html',
  styleUrl: './list-instances-dialog.component.scss'
})
export class ListInstancesDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  selectedInstances: Instance[] = [];
  schemaClasses: string = '';
  title: string = '';
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: { schemaClass: SchemaClass, title: string },
    public dialogRef: MatDialogRef<ListInstancesDialogService>) {
    this.schemaClasses = data.schemaClass.name;
    this.candidateClasses = Array.from(this.grepConcreteClasses(data.schemaClass, new Set<string>()));
    this.selected = data.schemaClass.name;
    this.title = data.title;
  }

  private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<string>): Set<string> {
    concreteClsNames.add(schemaClass.name);
    if (schemaClass.parent) {
      concreteClsNames.add(schemaClass.parent.name);
      this.grepConcreteClasses(schemaClass.parent, concreteClsNames)
    }
    return concreteClsNames
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
