import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from 'src/app/core/services/data.service';
import {AttributeValue} from '../instance-view/instance-table/instance-table.model';
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './new-instance-dialog.component.html',
  styleUrls: ['./new-instance-dialog.component.scss']
})
export class NewInstanceDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  instance: Instance | undefined;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
              public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
              private dataService: DataService) {
      this.candidateClasses = dataService.setCandidateClasses(attributeValue.attribute);
      this.selected = this.candidateClasses![0];
      this.dataService.createNewInstance(this.selected).subscribe(instance => this.instance = instance);
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
    this.dataService.registerNewInstance(this.instance!);
    this.dialogRef.close(this.instance);
  }

  // setCandidateClasses(attributeValue: AttributeValue) {
  //   // @ts-ignore
  //   let concreteClassNames = new Set<string>();
  //   for (let clsName of attributeValue.attribute.allowedClases!) {
  //     let schemaClass: SchemaClass = this.dataService.getSchemaClass(clsName)!;
  //     this.grepConcreteClasses(schemaClass, concreteClassNames);
  //   }
  //   this.candidateClasses = [...concreteClassNames];
  //   this.candidateClasses.sort();
  // }
  //
  // private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
  //   if (!schemaClass.abstract)
  //     concreteClsNames.add(schemaClass.name);
  //   if (schemaClass.children) {
  //     for (let child of schemaClass.children) {
  //       this.grepConcreteClasses(child, concreteClsNames)
  //     }
  //   }
  // }
}
