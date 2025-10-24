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
              private dataService: DataService,
              private store: Store) {
    // initialize candidate classes and selected value, then create the initial instance
    this.candidateClasses = [];
    const candidateResult: any = this.dataService.setCandidateClasses(attributeValue.attribute);
    // handle Observable
    if (candidateResult instanceof Observable) {
      candidateResult.subscribe((classes: string[]) => {
        this.candidateClasses = classes || [];
        this.selected = this.candidateClasses?.[0] ?? '';
        this.dataService.createNewInstance(this.selected).subscribe((instance: Instance) => this.instance = instance);
      });
    // handle Promise
    } else if (candidateResult) {
      candidateResult.then((classes: string[]) => {
        this.candidateClasses = classes || [];
        this.selected = this.candidateClasses?.[0] ?? '';
        this.dataService.createNewInstance(this.selected).subscribe((instance: Instance) => this.instance = instance);
      });
    // handle synchronous array return
    } else {
      this.candidateClasses = candidateResult || [];
      this.selected = this.candidateClasses?.[0] ?? '';
      this.dataService.createNewInstance(this.selected).subscribe((instance: Instance) => this.instance = instance);
    }
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
