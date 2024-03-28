import {CdkDrag, CdkDragPlaceholder, CdkDropList} from "@angular/cdk/drag-drop";
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from "@angular/cdk/menu";
import {CommonModule, NgOptimizedImage} from '@angular/common';
import { NgModule } from '@angular/core';
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatTooltipModule } from "@angular/material/tooltip";
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { ListInstancesModule } from "../list-instances/list-instances.module";
import { SchemaClassTreeModule } from "../schema-class/components/tree/schema-class-tree.module";
import { SharedModule } from '../../shared/shared.module';
import { BreadCrumbComponent } from './components/instance-view/bread-crumb/bread-crumb.component';
import {
  ActionMenuComponent
} from "./components/instance-view/instance-table/instance-table-row-element/action-menu/action-menu.component";
import {
  DisableControlDirective
} from "./components/instance-view/instance-table/instance-table-row-element/disableControlDirective";
import {
  InstanceTableRowElementComponent
} from './components/instance-view/instance-table/instance-table-row-element/instance-table-row-element.component';
import { InstanceTableComponent } from './components/instance-view/instance-table/instance-table.component';
import { InstanceViewComponent } from './components/instance-view/instance-view.component';
import { NewInstanceDialogComponent } from './components/new-instance-dialog/new-instance-dialog.component';
import { InstanceRoutingModule } from './instance-routing.module';
import { DatabaseObjectEffects } from './state/instance.effects';
import {NewInstanceEffects} from "./state/new-instance/new-instance.effects";
import {NEW_INSTANCES_STATE_NAME} from "./state/new-instance/new-instance.selectors";
import {newInstancesReducer} from "./state/new-instance/new-instance.reducers";
import { TextCurationComponent } from "../main-schema-view/components/text-curation/text-curation.component";

@NgModule({
    declarations: [
        InstanceTableComponent,
        ActionMenuComponent,
        InstanceTableRowElementComponent,
        BreadCrumbComponent,
        InstanceViewComponent,
        NewInstanceDialogComponent,
        DisableControlDirective
    ],
  imports: [
    CommonModule,
    InstanceRoutingModule,
    EffectsModule.forFeature(DatabaseObjectEffects),
    EffectsModule.forFeature(NewInstanceEffects),
    StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),

    // Need to register here for update. The registered state can be used out of this module.
    // StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
    SharedModule,
    CdkContextMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    SchemaClassTreeModule,
    MatTooltipModule,
    MatSidenavModule,
    CdkDrag,
    ListInstancesModule,
    CdkDropList,
    NgOptimizedImage,
    CdkDragPlaceholder,
    TextCurationComponent
  ],
  exports: [
    InstanceTableComponent,
    InstanceTableRowElementComponent,
  ]
})
export class InstanceModule {
}
