import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventTreeComponent } from './event-tree.component';
import { MaterialModule } from '../../../shared/material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {SharedModule} from "../../../shared/shared.module";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterLink} from "@angular/router";
import {ReleaseFlagComponent} from "./release-flag-icon/release-flag-icon.component";
import {FilterEventsComponent} from "../../../event/components/filter_events/filter_events.component";
import { ClassNameIconComponent } from './class-name-icon/class-name-icon.component';
import { CdkDrag, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';

@NgModule({
  declarations: [
    EventTreeComponent,
    ClassNameIconComponent,
    ReleaseFlagComponent
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
    FilterEventsComponent,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder
  ],
  exports: [MaterialModule, EventTreeComponent]
})
export class EventTreeModule { }
