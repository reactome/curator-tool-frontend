// currently following example at:
// https://stackblitz.com/edit/angular-and-material-multi-level-menu-with-breadcrumb-not-worki?file=src%2Fapp%2Fapp.component.ts,src%2Fapp%2Fapp.component.css

//TODO: Use ngrx/store or entity to manage this.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Instance } from "../../../../core/models/reactome-instance.model";
import {DataSubjectService} from "src/app/core/services/data.subject.service";

@Component({
  selector: 'app-bread-crumb',
  templateUrl: './bread-crumb.component.html',
  styleUrls: ['./bread-crumb.component.scss']
})
export class BreadCrumbComponent {
  @Input() newMenuItem: Instance[] = new Array<Instance>;
  @Input() dbIds: Instance[] = new Array<Instance>;
  @Output() clickEvent = new EventEmitter<Instance>();

  dbIdsRemove: Instance[] = new Array<Instance>;
  constructor(private dataSubjectService: DataSubjectService) {
  }

  breadCrumb(menu: any, index: any) {
    this.clickEvent.emit(this.newMenuItem[index]);
    this.dbIdsRemove = this.newMenuItem.slice(index + 1);
    this.newMenuItem.splice(index + 1, this.newMenuItem.length);
    if (menu[index] && menu[index].items && menu[index].items.length) {
    }
    this.dataSubjectService.setDbId(this.newMenuItem[index].dbId.toString());
  }
}
