import { CdkAccordionModule } from "@angular/cdk/accordion";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { CommonModule, NgIf } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";
import { StoreModule } from '@ngrx/store';
import { InstanceModule } from 'src/app/instance/instance.module';
import { lastUpdatedInstanceReducer } from 'src/app/instance/state/instance.reducers';
import { LAST_UPDATED_INSTANCE_STATE_NAME } from 'src/app/instance/state/instance.selectors';
import { SharedModule } from 'src/app/shared/shared.module';
import { InstanceBookmarkModule } from "../../schema-view/instance-bookmark/instance-bookmark.module";
import { UpdatedInstanceListComponent } from "../../status/components/updated-instance-list/updated-instance-list.component";
import { StatusComponent } from "../../status/status.component";
import { EventFilterComponent } from "../components/event-filter/event_filter.component";
import { EventTreeModule } from "../components/event-tree/event-tree.module";
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';
import { MainEventRoutingModule } from "./main-event-routing.module";
import { MainEventComponent } from './main-event.component';
import { PathwayDiagramModule } from "../components/pathway-diagram/pathway-diagram.module";

@NgModule({
  declarations: [
    MainEventComponent,
  ],
  exports: [
    MainEventComponent,
  ],
  imports: [
    CommonModule,
    CdkDrag,
    MatSidenavModule,
    MatToolbarModule,
    EventTreeModule,
    RouterOutlet,
    UpdatedInstanceListComponent,
    StatusComponent,
    CdkAccordionModule,
    InstanceBookmarkModule,
    CdkDragHandle,
    MainEventRoutingModule,
    MatGridListModule,
    PathwayDiagramComponent,
    InstanceModule,
    SharedModule,
    EventFilterComponent,
    PathwayDiagramModule,
    StoreModule.forFeature(LAST_UPDATED_INSTANCE_STATE_NAME, lastUpdatedInstanceReducer),
]
})
export class MainEventModule { }
