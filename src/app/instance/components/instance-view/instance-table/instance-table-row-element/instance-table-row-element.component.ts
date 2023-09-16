import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from "@ngrx/store";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { SchemaClassTableActions } from "../../../../../schema-class-table/state/schema-class-table.actions";
import { AttributeValue } from '../instance-table.model';

/**
 * Used to display a single value of an Instance object.
 */
@Component({
  selector: 'app-instance-table-row-element',
  templateUrl: './instance-table-row-element.component.html',
  styleUrls: ['./instance-table-row-element.component.scss']
})
export class InstanceTableRowElementComponent {
  // Value to be displayed here
  @Input() attribute: SchemaAttribute | undefined = undefined;
  @Input() value: any; 
  @Input() index: number = 0; // The position for a value in multi-slot
  @Output() newValueEvent = new EventEmitter<AttributeValue>();

  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  CATEGORIES = AttributeCategory;

  constructor(private store: Store) {
  }

  onChange() {
    let attributeValue = {
      attribute: this.attribute!,
      value: this.value,
      index: this.index
    }
    console.debug("onChange: ", attributeValue);
    this.newValueEvent.emit(attributeValue);
  }

}


