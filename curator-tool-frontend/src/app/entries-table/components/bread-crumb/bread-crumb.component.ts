// currently following example at:
// https://stackblitz.com/edit/angular-and-material-multi-level-menu-with-breadcrumb-not-worki?file=src%2Fapp%2Fapp.component.ts,src%2Fapp%2Fapp.component.css

import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import { Router} from "@angular/router";

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

  breadCrumbMain() {
    this.clickEvent.emit(this.mainNavigation);
    this.newMenuItem = [];
    //TODO: clear the tables held in the store
  }

  breadCrumb(menu: any, index: any) {
    this.clickEvent.emit(this.newMenuItem[index]);
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
