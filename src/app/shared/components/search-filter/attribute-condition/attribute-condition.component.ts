import {Component, EventEmitter, Input, Output} from '@angular/core';
import {SchemaAttribute} from "../../../../core/models/reactome-schema.model";

export interface AttributeCondition {
  attributeName: string;
  operand: string;
  searchKey: string;
  index: number;
}

@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set schemaClassAttributes(schemaClassAttributes: string[]) {
    this.schemaAttributes = schemaClassAttributes;
  }
  // To display existing conditions
  @Input() set attributeCondition(attributeCondition: AttributeCondition) {
    this.selectedAttribute = attributeCondition.attributeName;
    this.selectedOperand = attributeCondition.operand;
    this.searchKey  = attributeCondition.attributeName;
    this.index = attributeCondition.index;
  }

  @Output() addAttributeCondition: EventEmitter<any> = new EventEmitter();
  @Output() removeAttributeCondition: EventEmitter<any> = new EventEmitter();
  @Output() updateAttributeCondition: EventEmitter<any> = new EventEmitter();

  schemaAttributes: string[] = [];
  selectedAttribute: string = "displayName";
  selectedOperand: string = "Contains";
  searchKey: string = "";
  index: number = 0;
  operands: string[] = [
    'Equal',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  recordSearchKey(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.searchKey = text;
    // Make sure reset it to undefined if nothing there so that
    // no empty string sent to the server
    if (this.searchKey !== undefined && this.searchKey.length === 0) {
      return;
    }
    let attributeCondition: AttributeCondition = {
      attributeName: this.selectedAttribute,
      operand: this.selectedOperand,
      searchKey: this.searchKey,
      index : this.index
    }
    this.updateAttributeCondition.emit(attributeCondition);
  }

  add(){
    let attributeCondition: AttributeCondition = {
      attributeName: this.selectedAttribute,
      operand: this.selectedOperand,
      searchKey: this.searchKey,
      index : this.index
    }
    this.addAttributeCondition.emit(attributeCondition);
  }

  remove(){
    this.removeAttributeCondition.emit(this.attributeCondition);
  }
}
