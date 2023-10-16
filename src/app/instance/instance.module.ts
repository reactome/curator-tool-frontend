import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from "@angular/cdk/menu";
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { SharedModule } from '../shared/shared.module';
import { BreadCrumbComponent } from './components/instance-view/bread-crumb/bread-crumb.component';
import { ActionMenuComponent } from "./components/instance-view/instance-table/instance-table-row-element/action-menu/action-menu.component";
import { InstanceTableRowElementComponent } from './components/instance-view/instance-table/instance-table-row-element/instance-table-row-element.component';
import { InstanceTableComponent } from './components/instance-view/instance-table/instance-table.component';
import { InstanceViewComponent } from './components/instance-view/instance-view.component';
import { NewInstanceDialogComponent } from './components/new-instance-dialog/new-instance-dialog.component';
import { DatabaseObjectRoutingModule } from './instance-routing.module';
import { DatabaseObjectEffects } from './state/instance.effects';
import { VIEW_INSTANCE_STATE_NAME } from './state/instance.selectors';
import { viewInstanceReducer } from "./state/instance.reducers";
import {SchemaClassTreeModule} from "../schema-class/components/tree/schema-class-tree.module";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatSidenavModule} from "@angular/material/sidenav";
import {CdkDrag} from "@angular/cdk/drag-drop";

@NgModule({
  declarations: [
    InstanceTableComponent,
    ActionMenuComponent,
    InstanceTableRowElementComponent,
    BreadCrumbComponent,
    InstanceViewComponent,
    NewInstanceDialogComponent,
  ],
    imports: [
        CommonModule,
        DatabaseObjectRoutingModule,
        EffectsModule.forFeature(DatabaseObjectEffects),
        StoreModule.forFeature(VIEW_INSTANCE_STATE_NAME, viewInstanceReducer),
        SharedModule,
        CdkContextMenuTrigger,
        CdkMenu,
        CdkMenuItem,
        SchemaClassTreeModule,
        MatTooltipModule,
        MatSidenavModule,
        CdkDrag
    ],
})
export class DatabaseObjectModule {
}
