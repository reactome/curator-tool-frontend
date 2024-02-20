import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MaterialModule} from '../material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import { SafePipe } from './safe.pipe';

@NgModule({
  declarations: [
    SafePipe
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf
  ],
    exports: [MaterialModule, SafePipe]
})
export class SharedModule {
}
