import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AttributeCondition } from 'src/app/core/models/reactome-instance.model';


@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set schemaClassAttributes(schemaClassAttributes: string[]) {
    this.schemaAttributes = schemaClassAttributes;
  }

  @Input() attributeCondition! : AttributeCondition;

  @Output() addAttributeCondition: EventEmitter<AttributeCondition> = new EventEmitter();
  @Output() removeAttributeCondition: EventEmitter<AttributeCondition> = new EventEmitter();
  // Since AttributeCondition is passed, there is no need to track the changes for outside component.
  // @Output() updateAttributeCondition: EventEmitter<AttributeCondition> = new EventEmitter();

  schemaAttributes: string[] = [];

  operands: string[] = [
    'Equal',
    'Not Equal',
    'Contains',
    'IS NULL',
    'IS NOT NULL'
  ];

  blankAttributeCondition : AttributeCondition = {
    attributeName: "displayName",
    operand: "Contains",
    searchKey: "",
    index: 0
  };

  recordSearchKey(event: Event) {
    let text = (event.target as HTMLInputElement).value;
    this.attributeCondition.searchKey = text;
  }

  addNewPane(){
    let copyAttributeCondition = this.attributeCondition;
    this.attributeCondition = this.blankAttributeCondition;
    this.addAttributeCondition.emit(copyAttributeCondition);
  }

  removePane() {
    this.removeAttributeCondition.emit(this.attributeCondition);
  }
}
