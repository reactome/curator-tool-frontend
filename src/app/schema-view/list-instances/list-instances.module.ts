import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstanceSelectionComponent } from "./components/list-instances-view/table/instance-selection.component";
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list/instance-list-view.component";
import { SharedModule } from "../../shared/shared.module";
import { MaterialModule } from "../../shared/material/material.module";
import { SelectInstanceDialogComponent } from "./components/select-instance-dialog/select-instance-dialog.component";
import { SelectedInstancesTableComponent } from './components/select-instance-dialog/selected-instances-table/selected-instances-table.component';
import { MatTooltipModule } from "@angular/material/tooltip";
import { InstanceListTableComponent } from './components/list-instances-view/table/instance-list-table/instance-list-table.component';
import { StoreModule } from '@ngrx/store';
import { NEW_INSTANCES_STATE_NAME } from 'src/app/instance/state/instance.selectors';
import { newInstancesReducer } from 'src/app/instance/state/instance.reducers';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { ListInstancesDialogComponent } from './components/list-instances-dialog/list-instances-dialog.component';
import { BatchEditDialogComponent } from './components/list-instances-view/table/batch-edit-dialog/batch-edit-dialog.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {MatFormFieldModule } from '@angular/material/form-field';
import { AttributeEditComponent } from './components/list-instances-view/table/batch-edit-dialog/attribute-edit/attribute-edit.component';
import { EditMenuComponent } from './components/list-instances-view/table/batch-edit-dialog/attribute-edit/action-menu/action-menu.component';
import { AttributeListDialogComponent } from './components/list-instances-view/table/batch-edit-dialog/attribute-list-dialog/attribute-list-dialog.component';
import { MatDialog, MatDialogContent, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { ListInstancesRoutingModule } from './list-instances-routing.module';


@NgModule({
  declarations: [
    InstanceSelectionComponent,
    InstanceListViewComponent,
    SelectInstanceDialogComponent,
    SelectedInstancesTableComponent,
    InstanceListTableComponent,
    ListInstancesDialogComponent,
    BatchEditDialogComponent,
    AttributeListDialogComponent,
    EditMenuComponent,
    AttributeEditComponent,
  ],
  exports: [
    InstanceSelectionComponent,
    SelectInstanceDialogComponent,
    InstanceListTableComponent,
    ListInstancesDialogComponent,
    
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
    StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),
    MatSlideToggleModule,
    MatFormFieldModule,
    MatDialogModule,
    MatTableModule
],
})
export class ListInstancesModule {
}
