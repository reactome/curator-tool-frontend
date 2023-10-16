import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import { ResizableComponent } from './resizable/resizable.component';

@NgModule({
  declarations: [
    ResizableComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf
  ],
  exports: [MaterialModule, ResizableComponent]
})
export class SharedModule { }
