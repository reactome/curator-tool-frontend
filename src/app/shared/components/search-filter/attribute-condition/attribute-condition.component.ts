import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';


@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set schemaClassAttributes(schemaClassAttributes: string[]) {
    this.schemaAttributes = schemaClassAttributes;
  }

  @Input() attributeCondition! : SearchCriterium;

  @Output() addAttributeCondition: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() removeAttributeCondition: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() submitAction: EventEmitter<SearchCriterium> = new EventEmitter();

  schemaAttributes: string[] = [];

  operands: string[] = [
    'Equal',
    'Not Equal',
    'Contains',
    'IS NULL',
    'IS NOT NULL'
  ];

  blankAttributeCondition : SearchCriterium = {
    attributeName: "displayName",
    operand: "Contains",
    searchKey: "",
  };

  completeQuery() {
    let copyAttributeCondition = this.attributeCondition;
    this.attributeCondition = this.blankAttributeCondition;
    this.addAttributeCondition.emit(copyAttributeCondition);
    this.submitAction.emit(copyAttributeCondition);
  }

  addNewCriterium(){
    let copyAttributeCondition = this.attributeCondition;
    this.attributeCondition = this.blankAttributeCondition;
    this.addAttributeCondition.emit(copyAttributeCondition);
  }

}
