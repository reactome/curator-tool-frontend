import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttributeTableRoutingModule } from './attribute-table-routing.module';
import { AttributeTableComponent } from './pages/attributeTable/attribute-table.component';
import { EntriesTableComponent } from './pages/entries-table/entries-table.component';



@NgModule({
  declarations: [
    AttributeTableComponent,
    EntriesTableComponent

  ],
  imports: [
    CommonModule,
    AttributeTableRoutingModule
  ]
})
export class AttributeTableModule { }
