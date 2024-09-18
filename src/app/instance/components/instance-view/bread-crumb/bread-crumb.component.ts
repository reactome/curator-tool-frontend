// currently following example at:
// https://stackblitz.com/edit/angular-and-material-multi-level-menu-with-breadcrumb-not-worki?file=src%2Fapp%2Fapp.component.ts,src%2Fapp%2Fapp.component.css

//TODO: Use ngrx/store or entity to manage this.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Instance } from "../../../../core/models/reactome-instance.model";

@Component({
  selector: 'app-bread-crumb',
  templateUrl: './bread-crumb.component.html',
  styleUrls: ['./bread-crumb.component.scss']
})
export class BreadCrumbComponent {
  @Input() viewHistory: Instance[] = new Array<Instance>;
  @Output() clickEvent = new EventEmitter<Instance>();

  constructor() {}

  breadCrumb(menu: any, index: any) {
    this.clickEvent.emit(this.viewHistory[index]);
    this.viewHistory.splice(index + 1, this.viewHistory.length);
  }
}
