import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SchemaClassTableRoutingModule} from './schema-class-table-routing.module';
import {SchemaClassTableComponent} from './schema-class-table.component';
import {SchemaClassTableEffects} from './state/schema-class-table.effects';
import {StoreModule} from '@ngrx/store';
import {schemaClassTableReducer} from './state/schema-class-table.reducers';
import {EffectsModule} from '@ngrx/effects';
import { VIEW_SCHEMA_CLASS_STATE_NAME } from './state/schema-class-table.selectors';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    SchemaClassTableRoutingModule,
    SchemaClassTableComponent,
    EffectsModule.forFeature(SchemaClassTableEffects),
    StoreModule.forFeature(VIEW_SCHEMA_CLASS_STATE_NAME, schemaClassTableReducer)
  ]
})
export class SchemaClassTableModule {
}
