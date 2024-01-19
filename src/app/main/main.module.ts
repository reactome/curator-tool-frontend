import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main.component';
import {CdkDrag, CdkDragHandle} from "@angular/cdk/drag-drop";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatToolbarModule} from "@angular/material/toolbar";
import {SchemaClassTreeModule} from "../schema-class/components/tree/schema-class-tree.module";
import {RouterOutlet} from "@angular/router";
import { SideNavigationComponent } from './components/side-navigation/side-navigation.component';
import {UpdatedInstanceListComponent} from "../status/components/updated-instance-list/updated-instance-list.component";
import {StatusComponent} from "../status/status.component";
import {CdkAccordionModule} from "@angular/cdk/accordion";
import {InstanceBookmarkModule} from "../instance-bookmark/instance-bookmark.module";


@NgModule({
  declarations: [
    MainComponent,
    SideNavigationComponent
  ],
  exports: [
    MainComponent,
    SideNavigationComponent
  ],
  imports: [
    CommonModule,
    CdkDrag,
    MatSidenavModule,
    MatToolbarModule,
    SchemaClassTreeModule,
    RouterOutlet,
    UpdatedInstanceListComponent,
    StatusComponent,
    CdkAccordionModule,
    InstanceBookmarkModule,
    CdkDragHandle,
  ]
})
export class MainModule { }
