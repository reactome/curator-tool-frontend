import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SchemaClassTableRoutingModule } from './schema-class-table-routing.module';
import { SchemaClassTableComponent } from './schema-class-table.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    SchemaClassTableRoutingModule,
    SchemaClassTableComponent,
  ]
})
export class SchemaClassTableModule {
}
