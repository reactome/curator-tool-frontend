import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntriesTableComponent } from './components/entries-table/entries-table.component';
import { EntriesTableEffects } from './state/entries-table.effects';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { entriesTableReducer } from './state/entries-table.reducers';
import { ToolBarComponent } from './components/tool-bar/tool-bar.component';
import { EntitiesTableRoutingModule } from './entities-table-routing.module';
import { SharedModule } from '../shared/shared.module';



@NgModule({
  declarations: [
     EntriesTableComponent,
     ToolBarComponent
  ],
  imports: [
    CommonModule,
    EntitiesTableRoutingModule,
    EffectsModule.forFeature(EntriesTableEffects),
    StoreModule.forFeature('entriesDataState', entriesTableReducer),
    SharedModule  ],
})
export class EntitiesTableModule { }
