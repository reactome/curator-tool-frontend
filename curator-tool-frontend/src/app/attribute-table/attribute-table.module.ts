import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttributeTableRoutingModule } from './attribute-table-routing.module';
import { AttributeTableComponent } from './pages/attributeTable/attribute-table.component';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    AttributeTableRoutingModule,
    AttributeTableComponent
  ]
})
export class AttributeTableModule { }
