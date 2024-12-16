import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstanceSelectionComponent } from "./components/list-instances-view/table/instance-selection.component";
import { ListInstancesRoutingModule } from "./list-instances-routing.module";
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list-view.component";
import { SharedModule } from "../../shared/shared.module";
import { MaterialModule } from "../../shared/material/material.module";
import { SelectInstanceDialogComponent } from "./components/select-instance-dialog/select-instance-dialog.component";
import { SelectedInstancesTableComponent } from './components/select-instance-dialog/selected-instances-table/selected-instances-table.component';
import { MatTooltipModule } from "@angular/material/tooltip";
import { InstanceListTableComponent } from './components/list-instances-view/table/instance-list-table/instance-list-table.component';
import { StoreModule } from '@ngrx/store';
import { NEW_INSTANCES_STATE_NAME } from 'src/app/instance/state/instance.selectors';
import { newInstancesReducer } from 'src/app/instance/state/instance.reducers';
import { InstanceListMenuComponent } from './components/list-instances-view/table/instance-list-table/instance-list-menu/instance-list-menu.component';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';


@NgModule({
  declarations: [
    InstanceSelectionComponent,
    InstanceListViewComponent,
    SelectInstanceDialogComponent,
    SelectedInstancesTableComponent,
    InstanceListTableComponent,
    InstanceListMenuComponent
  ],
  exports: [
    InstanceSelectionComponent,
    SelectInstanceDialogComponent,
    InstanceListTableComponent,
    InstanceListMenuComponent
  ],
  imports: [
    CommonModule,
    ListInstancesRoutingModule,
    MaterialModule,
    MatTooltipModule,
    SharedModule,
    CdkContextMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    // Import this to avoid an error when reload schema_view/list_instance.
    StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer)
  ],
})
export class ListInstancesModule {
}
