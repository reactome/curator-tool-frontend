import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaClassTreeComponent } from './schema-class-tree.component';
import { MaterialModule } from '../../../../shared/material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {SharedModule} from "../../../../shared/shared.module";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterLink} from "@angular/router";


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
        MatTooltipModule,
        RouterLink
    ],
  exports: [MaterialModule, SchemaClassTreeComponent]
})
export class SchemaClassTreeModule { }
