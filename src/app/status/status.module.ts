import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusComponent } from './status/status.component';
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';
import { StoreModule } from '@ngrx/store';
import { UPDATE_INSTANCES_STATE_NAME } from '../instance/state/instance.selectors';
import { updatedInstancesReducer } from '../instance/state/instance.reducers';

@NgModule({
  imports: [
    CommonModule,
    StatusComponent,
    UpdatedInstanceListComponent,
    // Need to register here for update to avoid a warning.
    StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
  ],
  exports: [
    StatusComponent // Have to export it!!!
  ],
})
export class StatusModule { }
