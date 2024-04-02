import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventTreeComponent } from './event-tree.component';
import { MaterialModule } from '../../../material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {SharedModule} from "../../../shared/shared.module";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterLink} from "@angular/router";
import {Icon1Component} from "../icon1/icon1.component";
import {Icon2Component} from "../icon2/icon2.component";
import {FilterEventsComponent} from "../filter_events/filter_events.component";

@NgModule({
  declarations: [
    EventTreeComponent,
    Icon1Component,
    Icon2Component
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    SharedModule,
    MatTooltipModule,
    RouterLink,
    FilterEventsComponent
  ],
  exports: [MaterialModule, EventTreeComponent]
})
export class EventTreeModule { }
