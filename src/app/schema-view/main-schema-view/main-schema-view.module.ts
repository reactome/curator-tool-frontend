import { CdkAccordionModule } from "@angular/cdk/accordion";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";
import { UpdatedInstanceListComponent } from "../../status/components/updated-instance-list/updated-instance-list.component";
import { StatusComponent } from "../../status/status.component";
import { InstanceBookmarkModule } from "../instance-bookmark/instance-bookmark.module";
import { SchemaClassTreeModule } from "../schema-class/components/tree/schema-class-tree.module";
import { MainSchemaViewRoutingModule } from "./main-schema-view-routing.module";
import { MainSchemaViewComponent } from './main-schema-view.component';
import { StatusModule } from "src/app/status/status.module";


@NgModule({
  declarations: [
    MainSchemaViewComponent
  ],
  exports: [
    MainSchemaViewComponent
  ],
  imports: [
    CommonModule,
    CdkDrag,
    MatSidenavModule,
    MatToolbarModule,
    SchemaClassTreeModule,
    RouterOutlet,
    CdkAccordionModule,
    InstanceBookmarkModule,
    CdkDragHandle,
    MainSchemaViewRoutingModule,
    MatSidenavModule,
    StatusModule
  ]
})
export class MainSchemaViewModule { }
