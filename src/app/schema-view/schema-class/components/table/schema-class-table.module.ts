import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SchemaClassTableRoutingModule } from './schema-class-table-routing.module';
import { SchemaClassTableComponent } from './schema-class-table.component';
import { CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf } from '@angular/cdk/scrolling';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    SchemaClassTableComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    SharedModule,
    MatTooltipModule,
    RouterLink,
    SchemaClassTableRoutingModule],
    exports: [SchemaClassTableComponent]
})
export class SchemaClassTableModule {
}
