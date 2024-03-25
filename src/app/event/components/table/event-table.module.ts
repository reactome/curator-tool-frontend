import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {EventTableRoutingModule} from './event-table-routing.module';
import {EventTableComponent} from './event-table.component';
import {EventTableEffects} from './state/event-table.effects';
import {StoreModule} from '@ngrx/store';
import {eventTableReducer} from './state/event-table.reducers';
import {EffectsModule} from '@ngrx/effects';
import { VIEW_EVENT_STATE_NAME } from './state/event-table.selectors';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    EventTableRoutingModule,
    EventTableComponent,
    EffectsModule.forFeature(EventTableEffects),
    StoreModule.forFeature(VIEW_EVENT_STATE_NAME, eventTableReducer)
  ]
})
export class EventTableModule {
}
