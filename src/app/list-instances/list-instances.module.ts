import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ListInstancesTableComponent} from "./components/table/list-instances-table.component";
import {ListInstancesRoutingModule} from "./list-instances-routing.module";
import {ListInstancesViewComponent} from "./components/list-instances-view/list-instances-view.component";
import {SharedModule} from "../shared/shared.module";
import {MaterialModule} from "../material/material.module";

@NgModule({
  declarations: [
    ListInstancesTableComponent,
    ListInstancesViewComponent,
  ],
  exports: [
    ListInstancesTableComponent
  ],
  imports: [
    CommonModule,
    ListInstancesRoutingModule,
    MaterialModule
  ]
})
export class ListInstancesModule {
}
