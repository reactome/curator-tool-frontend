import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from 'src/app/core/services/data.service';
import {AttributeValue} from '../instance-view/instance-table/instance-table.model';
import {SchemaClass} from "../../../core/models/reactome-schema.model";
import {SchemaClassData} from "../../../core/models/schema-class-attribute-data.model";

type ConcreteSchemaClasses = { name: string, values: SchemaClass[] };

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
export class NewInstanceDialogComponent implements OnInit {
  selected: string = '';
  schemaClassMap: Map<string, SchemaClass> = new Map<string, SchemaClass>();
  schemaHierarchyTree: SchemaClass | undefined;
  groups: ConcreteSchemaClasses[] = [];
  instance: Instance | undefined;
  // avoid reset the displayed instance
  private is_assigned: boolean = false;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
              public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
              private dataService: DataService) {

    //TODO: move all mapping to dataService
    this.dataService.fetchSchemaClassTree().subscribe(data => {
      this.schemaHierarchyTree = data
      this.schemaClassMap = this.dataService.getSchemaClassMap(this.schemaHierarchyTree);
      this.setSchemaClasses(attributeValue.attribute.allowedClases || []);
      this.selected = this.groups[0].values[0].name;
      this.dataService.createNewInstance(this.selected).subscribe(instance => this.instance = instance);
    })
  }

  ngOnInit(): void {
    // Fire an action to create a new instance.
    // Use the first allowable schema class for the time being
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

  setSchemaClasses(groupNames: string[]) {
    this.groups = groupNames.map(name => this.populateGroup({name, values: []}))
    // sort options by instance count so that more popular options appear first
    this.groups.forEach(group => group.values = group.values.sort((valueA, valueB) => (valueB.count || 0) - (valueA.count || 0)))
  }

  populateGroup(group: ConcreteSchemaClasses): ConcreteSchemaClasses {
    let schemaClass = this.schemaClassMap.get(group.name);
    if (!schemaClass) return group;
    if (!schemaClass.abstract) group.values.push(schemaClass);
    for (let child of schemaClass.children || []) {
      this.populateGroup({name: child.name, values: group.values});
    }
    return group;

  }
}
