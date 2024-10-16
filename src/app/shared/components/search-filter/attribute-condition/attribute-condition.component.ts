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

  completeQuery() {
    let copyAttributeCondition = this.cloneCriterium();
    this.addAttributeCondition.emit(copyAttributeCondition);
    this.submitAction.emit(copyAttributeCondition);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.ctrlKey) {
        // Handle Ctrl + Enter
        this.completeQuery();
      }
      else 
        this.addNewCriterium();
      event.preventDefault(); // Optionally prevent default behavior like form submission
    }
  }

  private cloneCriterium(): SearchCriterium {
    return {
      attributeName: this.attributeCondition.attributeName,
      operand: this.attributeCondition.operand,
      searchKey: this.attributeCondition.operand.includes('NULL') ? 'null' : this.attributeCondition.searchKey
    }
  }

  addNewCriterium(){
    let copyAttributeCondition = this.cloneCriterium();
    this.addAttributeCondition.emit(copyAttributeCondition);
  }

}
