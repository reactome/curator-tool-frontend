import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstanceSelectionComponent } from "./components/list-instances-view/table/instance-selection.component";
import { ListInstancesRoutingModule } from "./list-instances-routing.module";
import { ListInstancesViewComponent } from "./components/list-instances-view/list-instances-view.component";
import { SharedModule } from "../../shared/shared.module";
import { MaterialModule } from "../../shared/material/material.module";
import { SelectInstanceDialogComponent } from "./components/select-instance-dialog/select-instance-dialog.component";
import { SelectedInstancesTableComponent } from './components/select-instance-dialog/selected-instances-table/selected-instances-table.component';
import { MatTooltipModule } from "@angular/material/tooltip";
import { InstanceListTableComponent } from './components/list-instances-view/table/instance-list-table/instance-list-table.component';
import { FilterEventsComponent } from "../../event/components/filter_events/filter_events.component";
import { StoreModule } from '@ngrx/store';
import { NEW_INSTANCES_STATE_NAME } from 'src/app/instance/state/instance.selectors';
import { newInstancesReducer } from 'src/app/instance/state/instance.reducers';


@NgModule({
  declarations: [
    InstanceSelectionComponent,
    ListInstancesViewComponent,
    SelectInstanceDialogComponent,
    SelectedInstancesTableComponent,
    InstanceListTableComponent
  ],
  exports: [
    InstanceSelectionComponent,
    SelectInstanceDialogComponent,
    InstanceListTableComponent
  ],
  imports: [
    CommonModule,
    ListInstancesRoutingModule,
    MaterialModule,
    MatTooltipModule,
    FilterEventsComponent,
    SharedModule,
    // Import this to avoid an error when reload schema_view/list_instance.
    StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer)
  ],
})
export class ListInstancesModule {
}
