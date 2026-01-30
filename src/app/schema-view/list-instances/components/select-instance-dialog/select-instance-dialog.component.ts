import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaClass } from "../../../../core/models/reactome-schema.model";

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-select-instance-dialog',
  templateUrl: './select-instance-dialog.component.html',
  styleUrls: ['./select-instance-dialog.component.scss']
})

export class SelectInstanceDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  instance: Instance | undefined;
  selectedInstances: Instance[] = [];
  isSingleValued: boolean = false;
  attributeSchemaClass: string = '';
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
    public dialogRef: MatDialogRef<SelectInstanceDialogComponent>) {
    this.isSingleValued = this.attributeValue.attribute.cardinality === '1';
    this.attributeSchemaClass = this.attributeValue.attribute.name;
    this.setCandidateClasses(attributeValue);
    this.selected = this.candidateClasses![0];
  }

  onSelectRow(row: Instance) {
    if (this.isSingleValued) {
      // Only take one value if the cardinality is 1
      this.selectedInstances = [row];
    }
    // input, output, and hasComponent may have multiple values (ex: ATP)
    else if (this.attributeSchemaClass === 'input' || 
            this.attributeSchemaClass === 'output' || 
            this.attributeSchemaClass === 'hasComponent') {
      this.selectedInstances = [...this.selectedInstances, row];
    }
    else {
      this.selectedInstances = [...this.selectedInstances, row];
      let noDuplicates: Instance[] = [];
      this.selectedInstances.forEach(element => {
        if (!noDuplicates.includes(element)) {
          noDuplicates.push(element);
        }
      });
      this.selectedInstances = noDuplicates;
    }
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close(this.selectedInstances);
  }

  onRemoveEvent(instance: Instance) {
    let index = this.selectedInstances.indexOf(instance);
    this.selectedInstances.splice(index, 1);
    this.selectedInstances = [...this.selectedInstances];
  }

  setCandidateClasses(attributeValue: AttributeValue) {
    // @ts-ignore
    // Using allosed classes instead of concrete to simplify the drop-down menu
    this.candidateClasses = attributeValue.attribute.allowedClases!;
    // let concreteClassNames = new Set<string>();
    // for (let clsName of attributeValue.attribute.allowedClases!) {
    //   let schemaClass: SchemaClass = this.dataService.getSchemaClass(clsName)!;
    //   this.grepConcreteClasses(schemaClass, concreteClassNames);
    // }
    // this.candidateClasses = [...concreteClassNames];
    // this.candidateClasses.sort();
  }

  private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
    if (!schemaClass.abstract)
      concreteClsNames.add(schemaClass.name);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        this.grepConcreteClasses(child, concreteClsNames)
      }
    }
  }
}
