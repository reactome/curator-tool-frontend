import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntriesTableComponent } from './components/entries-table/entries-table.component';
import { EntriesTableEffects } from './state/entries-table.effects';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { entriesTableReducer } from './state/entries-table.reducers';
import { ActionMenuComponent } from './components/action-menu/action-menu.component';
import { EntriesTableRoutingModule } from './entries-table-routing.module';
import { SharedModule } from '../shared/shared.module';
import {DialogOverviewExampleDialog, RowElementComponent} from './components/row-element/row-element.component';
import {MatSortModule} from "@angular/material/sort";
import { BreadCrumbComponent } from './components/bread-crumb/bread-crumb.component';
import {MatIconModule} from "@angular/material/icon";
import {MatCardModule} from "@angular/material/card";



@NgModule({
  declarations: [
     EntriesTableComponent,
     ActionMenuComponent,
     RowElementComponent,
    DialogOverviewExampleDialog,
    BreadCrumbComponent,
  ],
  imports: [
    CommonModule,
    EntriesTableRoutingModule,
    EffectsModule.forFeature(EntriesTableEffects),
    StoreModule.forFeature('entriesDataState', entriesTableReducer),
    SharedModule
  ],
})
export class EntriesTableModule { }
