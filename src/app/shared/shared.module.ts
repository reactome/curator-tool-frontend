import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaPanelComponent } from './layout/schema-panel/schema-panel.component';
import { PipeNameComponent } from './pipes/pipe-name/pipe-name.component';
import { MaterialModule } from '../material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";



@NgModule({
  declarations: [
    SchemaPanelComponent,
    PipeNameComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf
  ],
    exports: [MaterialModule, SchemaPanelComponent]
})
export class SharedModule { }
