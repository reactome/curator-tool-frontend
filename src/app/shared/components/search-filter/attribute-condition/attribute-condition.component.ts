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
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  recordSearchKey(event: Event) {
    let text = (event.target as HTMLInputElement).value;
    this.attributeCondition.searchKey = text;
  }

  addNewPane(){
    this.addAttributeCondition.emit(undefined);
  }

  removePane() {
    this.removeAttributeCondition.emit(this.attributeCondition);
  }
}
