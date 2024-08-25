import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventTreeComponent } from './event-tree.component';
import { MaterialModule } from '../../../shared/material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {SharedModule} from "../../../shared/shared.module";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterLink} from "@angular/router";
import {ReleaseFlagComponent} from "./release-flag-icon/release-flag-icon.component";
import {FilterEventsComponent} from "../filter_events/filter_events.component";
import { ClassNameIconComponent } from './class-name-icon/class-name-icon.component';

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
    FilterEventsComponent
  ],
  exports: [MaterialModule, EventTreeComponent]
})
export class EventTreeModule { }
