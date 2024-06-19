import {Component, Input} from '@angular/core';
import {MatButton, MatIconButton} from "@angular/material/button";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {MatSelect} from "@angular/material/select";
import {MatTooltip} from "@angular/material/tooltip";
import {SchemaAttribute} from "../../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set selectedSchemaClass(selectedSchemaClass: string) {
    this.selectedClass = selectedSchemaClass;
  }
  // Adding flags to use the filter in the schema
  @Input() isSchemaView: boolean = false;
  @Input() set schemaClassAttributes(schemaClassAttributes: SchemaAttribute[]){
    this.schemaAttributes = schemaClassAttributes;
  }
  selectedClass: string = "";
  schemaAttributes: SchemaAttribute[] = [];
  selectedAttributes: string[] = ["displayName"];
  selectedOperands: string[] = ["Contains"];
  searchKeys: string[] = [];

}
