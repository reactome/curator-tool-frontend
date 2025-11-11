import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from "../../shared/shared.module";
import { MaterialModule } from "../../shared/material/material.module";
import { SelectInstanceDialogComponent } from "./components/select-instance-dialog/select-instance-dialog.component";
import { SelectedInstancesTableComponent } from './components/select-instance-dialog/selected-instances-table/selected-instances-table.component';
import { MatTooltipModule } from "@angular/material/tooltip";
import { StoreModule } from '@ngrx/store';
import { NEW_INSTANCES_STATE_NAME } from 'src/app/instance/state/instance.selectors';
import { newInstancesReducer } from 'src/app/instance/state/instance.reducers';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { ListInstancesDialogComponent } from './components/list-instances-dialog/list-instances-dialog.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogContent, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { ListInstancesRoutingModule } from './list-instances-routing.module';
import { CdkAccordion } from '@angular/cdk/accordion';
import { MatExpansionPanel } from '@angular/material/expansion';
import { DeleteBulkDialogComponent } from './components/delete-bulk-dialog/delete-bulk-dialog.component';
import { InstanceListViewComponent } from './components/list-instances-view/instance-list-view.component';
import { InstanceListTableComponent } from './components/list-instances-view/instance-list-table/instance-list-table.component';
import { EditMenuComponent } from './components/list-instances-view/batch-edit-dialog/attribute-edit/action-menu/action-menu.component';
import { AttributeEditComponent } from './components/list-instances-view/batch-edit-dialog/attribute-edit/attribute-edit.component';
import { AttributeListDialogComponent } from './components/list-instances-view/batch-edit-dialog/attribute-list-dialog/attribute-list-dialog.component';
import { BatchEditDialogComponent } from './components/list-instances-view/batch-edit-dialog/batch-edit-dialog.component';


@NgModule({
  declarations: [
    InstanceListViewComponent,
    SelectInstanceDialogComponent,
    SelectedInstancesTableComponent,
    ListInstancesDialogComponent,
    BatchEditDialogComponent,
    AttributeListDialogComponent,
    EditMenuComponent,
    AttributeEditComponent,
    DeleteBulkDialogComponent,
    InstanceListTableComponent
  ],

  exports: [
    SelectInstanceDialogComponent,
    InstanceListTableComponent,
    ListInstancesDialogComponent,
    InstanceListViewComponent
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
    MatTableModule,
    CdkAccordion,
    MatExpansionPanel,
],
})
export class ListInstancesModule {
}
