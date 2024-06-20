import {NgModule} from '@angular/core';
import {CommonModule, NgFor} from '@angular/common';
import {MaterialModule} from './material/material.module';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import { SafePipe } from './safe.pipe';
import {SearchFilterComponent} from "./components/search-filter/search-filter.component";
import {
  AttributeConditionComponent
} from "./components/search-filter/attribute-condition/attribute-condition.component";
import {MatTooltip} from "@angular/material/tooltip";

@NgModule({
  declarations: [
    SafePipe,
    SearchFilterComponent,
    AttributeConditionComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    NgFor,
    MatTooltip
  ],
    exports: [
      MaterialModule,
      SafePipe,
      SearchFilterComponent,
      AttributeConditionComponent]
})
export class SharedModule {
}
