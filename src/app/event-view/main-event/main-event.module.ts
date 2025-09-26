import { CdkAccordionModule } from "@angular/cdk/accordion";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";
import { InstanceModule } from 'src/app/instance/instance.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { InstanceBookmarkModule } from "../../schema-view/instance-bookmark/instance-bookmark.module";
import { EventFilterComponent } from "../components/event-filter/event_filter.component";
import { EventTreeModule } from "../components/event-tree/event-tree.module";
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';
import { MainEventRoutingModule } from "./main-event-routing.module";
import { MainEventComponent } from './main-event.component';
import { PathwayDiagramModule } from "../components/pathway-diagram/pathway-diagram.module";
import { StatusModule } from "src/app/status/status.module";

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
    StatusModule,
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
]
})
export class MainEventModule { }
