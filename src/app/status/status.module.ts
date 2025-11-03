import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSortModule } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { StoreModule } from '@ngrx/store';
import { updatedInstancesReducer } from '../instance/state/instance.reducers';
import { UPDATE_INSTANCES_STATE_NAME } from '../instance/state/instance.selectors';
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';
import { StatusComponent } from './status.component';
import { MaterialModule } from '../shared/material/material.module';
import { ListInstancesModule } from '../schema-view/list-instances/list-instances.module';

@NgModule({
  imports: [
    CommonModule,
    // Need to register here for update to avoid a warning.
    StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    MaterialModule,
    ListInstancesModule,
  ],
  declarations: [
    StatusComponent,
    UpdatedInstanceListComponent,
  ],
  exports: [
    StatusComponent,
    UpdatedInstanceListComponent,
  ],
})
export class StatusModule { }
