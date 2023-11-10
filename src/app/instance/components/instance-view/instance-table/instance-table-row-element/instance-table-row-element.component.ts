import {Component, EventEmitter, Input, NgZone, Output, ViewChild} from '@angular/core';
import { Store } from "@ngrx/store";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { AttributeValue, EDIT_ACTION } from '../instance-table.model';
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {take} from "rxjs";

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
  // Edit action
  @Output() editAction = new EventEmitter<AttributeValue>();

  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  CATEGORIES = AttributeCategory;

  isRequired: boolean = this.attribute?.category === AttributeCategory.REQUIRED || this.attribute?.category == AttributeCategory.MANDATORY;
  isDisabled: boolean = this.attribute?.category === AttributeCategory.NOMANUALEDIT;

  constructor(private store: Store, private _ngZone: NgZone) {
  }

  @ViewChild('autosize') autosize: CdkTextareaAutosize | undefined;

  onChange() {
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.value,
      index: this.index
    }
    console.debug("onChange: ", attributeValue);
    this.newValueEvent.emit(attributeValue);
    this.triggerResize();
  }

  onEditAction(action: EDIT_ACTION) {
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.value,
      index: this.index,
      editAction: action,
    }
    console.debug("onEditAction: ", attributeValue);
    this.editAction.emit(attributeValue);
  }

  triggerResize() {
    // Wait for changes to be applied, then trigger textarea resize.
    this._ngZone.onStable.pipe(take(1)).subscribe(() => this.autosize!.resizeToFitContent(true));
  }

  protected readonly undefined = undefined;
}


