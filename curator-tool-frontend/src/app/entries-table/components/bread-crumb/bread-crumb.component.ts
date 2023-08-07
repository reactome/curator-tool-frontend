// currently following example at:
// https://stackblitz.com/edit/angular-and-material-multi-level-menu-with-breadcrumb-not-worki?file=src%2Fapp%2Fapp.component.ts,src%2Fapp%2Fapp.component.css

import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-bread-crumb',
  templateUrl: './bread-crumb.component.html',
  styleUrls: ['./bread-crumb.component.scss']
})
export class BreadCrumbComponent implements OnInit{
  menuHeader: any = [];
  entryTables: any = [];
  mainClassName: string = 'Polymer';
  mainDbId: string = '8876883';
  showMainTable: boolean = true;
  showTable: boolean[] =[];
  counter: number = 0;
  className: string = '';

  constructor() { }

  ngOnInit() {
  }

  addEntryTable(data: any) {
    this.showMainTable = false;
    this.entryTables.push(data);
    this.menuHeader.push(data.displayName);
    this.showTable = [];
    this.showTable[this.counter] = true;
    this.counter++;
  }

  getClassName(className: string) {
    this.className = className;
  }

  breadCrumbMain() {
    this.showMainTable = true;
    this.menuHeader = [];
    this.showTable = [];
    this.entryTables.splice(1, this.menuHeader.length);
    //TODO: clear the tables held in the store
  }

  breadCrumb(menu: any, index: any) {
    console.log('sub breadCrumb');
    this.menuHeader.splice(index + 1, this.menuHeader.length - 1);
    this.entryTables.splice(index + 1, this.menuHeader.length);
    this.showTable = [];
    this.showTable[index] = true;
    if (menu[index] && menu[index].items && menu[index].items.length) {
    }
  }

  menuChange(menuChange: any) {

    if (menuChange.items) {
      this.menuHeader.push({ label: menuChange.label, icon: 'keyboard_arrow_right', items: menuChange.items });
      // this.menuHeader.push(menuChange);

      console.log('hasMultiMenuLabel');
    }
  }
}
