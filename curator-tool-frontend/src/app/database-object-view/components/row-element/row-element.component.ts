import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Store} from "@ngrx/store";
import {AttributeTableActions} from "../../../attribute-table/state/attribute-table.actions";

@Component({
  selector: 'app-row-element',
  templateUrl: './row-element.component.html',
  styleUrls: ['./row-element.component.scss']
})
export class RowElementComponent implements OnInit{
  @Input() elementType: string = 'STRING';
  @Input() elementValue: any = 'test';
  @Input() className: string = '';
  @Input() category: string = '';
  @Output() getClassNameEvent= new EventEmitter<string>();
  isDisabled: boolean = false;
  isRequired: boolean = false;
  showToolBar: boolean[] = [];
  row: {} = {};

  ngOnInit(): void {
    this.isDisabled = this.category[1] === "NOMANUALEDIT";
    this.isRequired = this.category[1] === "REQUIRED" || this.category[1] === "MANDATORY"
  }
  constructor(private store: Store) {
  }

  onClick() {
    this.store.dispatch(AttributeTableActions.get({className: this.className}) );
    this.getClassNameEvent.emit(this.elementValue.displayName);
  }

  toolBar(row: number) {
    this.showToolBar[row] = !this.showToolBar[row];
  }

}


