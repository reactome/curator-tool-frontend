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
import { RowElementComponent} from './components/row-element/row-element.component';
import { BreadCrumbComponent } from './components/bread-crumb/bread-crumb.component';
import { InstanceViewComponent } from './components/instance-view/instance-view.component';
import {CdkContextMenuTrigger, CdkMenu, CdkMenuItem} from "@angular/cdk/menu";

@NgModule({
  declarations: [
     EntriesTableComponent,
     ActionMenuComponent,
     RowElementComponent,
    BreadCrumbComponent,
    InstanceViewComponent,
  ],
  imports: [
    CommonModule,
    EntriesTableRoutingModule,
    EffectsModule.forFeature(EntriesTableEffects),
    StoreModule.forFeature('entriesDataState', entriesTableReducer),
    SharedModule,
    CdkContextMenuTrigger,
    CdkMenu,
    CdkMenuItem
  ],
})
export class EntriesTableModule { }
