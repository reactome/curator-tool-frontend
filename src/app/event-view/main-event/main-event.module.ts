import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainEventComponent } from './main-event.component';
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { EventTreeModule } from "../components/tree/event-tree.module";
import { RouterOutlet } from "@angular/router";
import { EventSideNavigationComponent } from './components/side-navigation/side-navigation.component';
import { UpdatedInstanceListComponent } from "../../status/components/updated-instance-list/updated-instance-list.component";
import { StatusComponent } from "../../status/status.component";
import { CdkAccordionModule } from "@angular/cdk/accordion";
import { InstanceBookmarkModule } from "../../schema-view/instance-bookmark/instance-bookmark.module";
import { MainEventRoutingModule } from "./main-event-routing.module";
import { GraphicDisplayModule } from "../graphic-display/graphic-display.module";
import { MatGridListModule } from '@angular/material/grid-list';
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';
import { InstanceModule } from 'src/app/instance/instance.module';

@NgModule({
  declarations: [
    MainEventComponent,
    EventSideNavigationComponent
  ],
  exports: [
    MainEventComponent,
    EventSideNavigationComponent
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
    GraphicDisplayModule,
    MatGridListModule,
    PathwayDiagramComponent,
    InstanceModule
  ]
})
export class MainEventModule { }
