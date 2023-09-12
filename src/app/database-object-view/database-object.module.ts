import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {InstanceTableComponent} from './components/instance-view/instance-table/instance-table.component';
import {DatabaseObjectEffects} from './state/database-object.effects';
import {EffectsModule} from '@ngrx/effects';
import {StoreModule} from '@ngrx/store';
import {databaseObjectReducer} from './state/database-object.reducers';
import {ActionMenuComponent} from './components/action-menu/action-menu.component';
import {DatabaseObjectRoutingModule} from './database-object-routing.module';
import {SharedModule} from '../shared/shared.module';
import {InstanceTableRowElementComponent} from './components/instance-view/instance-table/instance-table-row-element/instance-table-row-element.component';
import {BreadCrumbComponent} from './components/bread-crumb/bread-crumb.component';
import {InstanceViewComponent} from './components/instance-view/instance-view.component';
import {CdkContextMenuTrigger, CdkMenu, CdkMenuItem} from "@angular/cdk/menu";

@NgModule({
  declarations: [
    InstanceTableComponent,
    ActionMenuComponent,
    InstanceTableRowElementComponent,
    BreadCrumbComponent,
    InstanceViewComponent,
  ],
  imports: [
    CommonModule,
    DatabaseObjectRoutingModule,
    EffectsModule.forFeature(DatabaseObjectEffects),
    StoreModule.forFeature('databaseObjectState', databaseObjectReducer),
    SharedModule,
    CdkContextMenuTrigger,
    CdkMenu,
    CdkMenuItem
  ],
})
export class DatabaseObjectModule {
}
