import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Store} from "@ngrx/store";
import {SchemaClassTableActions} from "../../../../../schema-class-table/state/schema-class-table.actions";

@Component({
  selector: 'app-instance-table-row-element',
  templateUrl: './instance-table-row-element.component.html',
  styleUrls: ['./instance-table-row-element.component.scss']
})
export class InstanceTableRowElementComponent implements OnInit {
  @Input() elementType: string = 'STRING';
  @Input() elementValue: any = 'test';
  @Input() className: string = '';
  @Input() category: string = '';
  @Input() key: string = '';
  @Output() getClassNameEvent = new EventEmitter<string>();
  @Output() getNewValueEvent = new EventEmitter<any>();
  isDisabled: boolean = false;
  isRequired: boolean = false;
  databaseObject: { key: string, value: any, type: string, javaType: string } = {
    key: '',
    value: undefined,
    type: '',
    javaType: ''
  };

  ngOnInit(): void {
    this.isDisabled = this.category[1] === "NOMANUALEDIT";
    this.isRequired = this.category[1] === "REQUIRED" || this.category[1] === "MANDATORY"
  }

  constructor(private store: Store) {
  }

  onClick() {
    this.store.dispatch(SchemaClassTableActions.get({className: this.className}));
    this.getClassNameEvent.emit(this.elementValue.displayName);
  }

  onChange() {
    this.databaseObject.key = this.key;
    this.databaseObject.type = this.elementType;
    this.databaseObject.value = this.elementValue;
    this.databaseObject.javaType = this.elementType;
    console.log(this.databaseObject);
    this.getNewValueEvent.emit(this.databaseObject);
  }

}


