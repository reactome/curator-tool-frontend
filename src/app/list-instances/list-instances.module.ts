import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ListInstancesTableComponent} from "./components/list-instances-view/table/list-instances-table.component";
import {ListInstancesRoutingModule} from "./list-instances-routing.module";
import {ListInstancesViewComponent} from "./components/list-instances-view/list-instances-view.component";
import {SharedModule} from "../shared/shared.module";
import {MaterialModule} from "../material/material.module";
import {SelectInstanceDialogComponent} from "./components/select-instance-dialog/select-instance-dialog.component";
import { SelectedInstancesTableComponent } from './components/select-instance-dialog/selected-instances-table/selected-instances-table.component';

@NgModule({
  declarations: [
    ListInstancesTableComponent,
    ListInstancesViewComponent,
    SelectInstanceDialogComponent,
    SelectedInstancesTableComponent
  ],
  exports: [
    ListInstancesTableComponent,
    SelectInstanceDialogComponent
  ],
  imports: [
    CommonModule,
    ListInstancesRoutingModule,
    MaterialModule
  ]
})
export class ListInstancesModule {
}
