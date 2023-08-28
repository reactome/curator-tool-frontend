// currently following example at:
// https://stackblitz.com/edit/angular-and-material-multi-level-menu-with-breadcrumb-not-worki?file=src%2Fapp%2Fapp.component.ts,src%2Fapp%2Fapp.component.css

import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {AttributeTableActions} from "../../../attribute-table/state/attribute-table.actions";
import {Store} from "@ngrx/store";
import {DatabaseObjectActions} from "../../state/database-object.actions";

@Component({
  selector: 'app-bread-crumb',
  templateUrl: './bread-crumb.component.html',
  styleUrls: ['./bread-crumb.component.scss']
})
export class BreadCrumbComponent{
  @Input() mainNavigation: string = '8876883';
  @Input() newMenuItem: string[] = new Array<string>;
  @Input() dbIds: string[] = new Array<string>;
  @Output() clickEvent = new EventEmitter<string>();

  dbIdsRemove: string[] = new Array<string>;
  constructor(private store: Store, private route: ActivatedRoute) {
  }

  breadCrumbMain() {
    this.clickEvent.emit(this.mainNavigation);
    this.newMenuItem = [];
    //TODO: clear the tables held in the store
  }

  breadCrumb(menu: any, index: any) {
    this.clickEvent.emit(this.newMenuItem[index]);
    this.dbIdsRemove = this.newMenuItem.slice(index + 1);
    this.store.dispatch(DatabaseObjectActions.remove({dbIds: this.dbIdsRemove}));
    this.newMenuItem.splice(index + 1, this.newMenuItem.length);

    if (menu[index] && menu[index].items && menu[index].items.length) {
    }
  }

  menuChange(menuChange: any) {

    if (menuChange.items) {
      this.newMenuItem.push(">");
      // this.menuHeader.push(menuChange);

      console.log('hasMultiMenuLabel');
    }
  }
}
