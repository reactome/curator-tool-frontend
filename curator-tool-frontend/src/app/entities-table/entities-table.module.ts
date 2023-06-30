import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntriesTableComponent } from './components/entries-table/entries-table.component';
import { EntriesTableEffects } from './state/entries-table.effects';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { entriesTableReducer } from './state/entries-table.reducers';



@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    EntriesTableComponent,
    EffectsModule.forFeature(EntriesTableEffects),
    StoreModule.forFeature('entriesDataState', entriesTableReducer)
  ]
})
export class EntitiesTableModule { }
