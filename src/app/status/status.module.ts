import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusComponent } from './status.component';
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';
import { StoreModule } from '@ngrx/store';
import { UPDATE_INSTANCES_STATE_NAME } from '../instance/state/instance.selectors';
import { updatedInstancesReducer } from '../instance/state/instance.reducers';
import { CompareUpdatedInstanceComponent } from './components/compare-updated-instance/compare-updated-instance.component';
import {DatabaseObjectModule} from "../instance/instance.module";
import {
  CompareUpdatedInstanceDialog
} from "./components/compare-updated-instance-dialog/compare-updated-instance-dialog.component";
import {MatDialogModule} from "@angular/material/dialog";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatIconModule} from "@angular/material/icon";
import {MatSortModule} from "@angular/material/sort";
import {MatTableModule} from "@angular/material/table";
import {MatTooltipModule} from "@angular/material/tooltip";

@NgModule({
  imports: [
    CommonModule,
    StatusComponent,
    UpdatedInstanceListComponent,
    // Need to register here for update to avoid a warning.
    StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
    DatabaseObjectModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  exports: [
    StatusComponent // Have to export it!!!
  ],
  declarations: [
    CompareUpdatedInstanceComponent,
    CompareUpdatedInstanceDialog
  ],
})
export class StatusModule { }
