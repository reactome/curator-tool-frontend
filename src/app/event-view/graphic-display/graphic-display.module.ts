import {CdkDrag, CdkDragPlaceholder, CdkDropList} from "@angular/cdk/drag-drop";
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from "@angular/cdk/menu";
import {CommonModule, NgOptimizedImage} from '@angular/common';
import { NgModule } from '@angular/core';
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatTooltipModule } from "@angular/material/tooltip";
import { EffectsModule } from '@ngrx/effects';
import { SharedModule } from '../../shared/shared.module';
import { EventPlotComponent } from './components/event-plot/event-plot.component';
import { GraphicDisplayRoutingModule } from './graphic-display-routing.module';

@NgModule({
    declarations: [
        EventPlotComponent
    ],
  imports: [
    CommonModule,
    GraphicDisplayRoutingModule,
    SharedModule,
    CdkContextMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    MatTooltipModule,
    MatSidenavModule,
    CdkDrag,
    CdkDropList,
    NgOptimizedImage,
    CdkDragPlaceholder,
  ],
  exports: [
    EventPlotComponent
  ]
})
export class GraphicDisplayModule {
}
