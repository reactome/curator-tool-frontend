import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main.component';
import {CdkDrag} from "@angular/cdk/drag-drop";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatToolbarModule} from "@angular/material/toolbar";
import {SchemaClassTreeModule} from "../schema-class/components/tree/schema-class-tree.module";
import {RouterOutlet} from "@angular/router";



@NgModule({
  declarations: [
    MainComponent
  ],
  exports: [
    MainComponent
  ],
  imports: [
    CommonModule,
    CdkDrag,
    MatSidenavModule,
    MatToolbarModule,
    SchemaClassTreeModule,
    RouterOutlet
  ]
})
export class MainModule { }
