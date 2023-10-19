import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaClassTreeComponent } from './schema-class-tree.component';
import { MaterialModule } from '../../../material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {SharedModule} from "../../../shared/shared.module";
import {MatTooltipModule} from "@angular/material/tooltip";



@NgModule({
  declarations: [
    SchemaClassTreeComponent],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    SharedModule,
    MatTooltipModule
  ],
  exports: [MaterialModule, SchemaClassTreeComponent]
})
export class SchemaClassTreeModule { }
