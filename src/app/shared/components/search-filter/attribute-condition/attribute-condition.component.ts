import {Component, EventEmitter, Input, Output} from '@angular/core';
import {SchemaAttribute} from "../../../../core/models/reactome-schema.model";

interface AttributeCondition{
  attributeName: string;
  operand: string;
  searchKey: string;
}

@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set schemaClassAttributes(schemaClassAttributes: SchemaAttribute[]){
    this.schemaAttributes = schemaClassAttributes;
  }
  @Output() addAttributeCondition: EventEmitter<any> = new EventEmitter();

  schemaAttributes: SchemaAttribute[] = [];
  selectedAttribute: string = "displayName";
  selectedOperand: string = "Contains";
  searchKey: string = "";
  operands: string[] = [
    'Equal',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  recordSearchKey($event: KeyboardEvent) {
      let attributeCondition: AttributeCondition = {
        attributeName: this.selectedAttribute,
        operand: this.selectedOperand,
        searchKey: this.searchKey
      }
      this.addAttributeCondition.emit(attributeCondition);
  }
}
