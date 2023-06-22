import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AttributeTableComponent } from './pages/attributeTable/attribute-table.component';

const routes: Routes = [
  {
    path: "",
    component: AttributeTableComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    AttributeTableComponent
  ],
  exports:[RouterModule]
})
export class AttributeTableRoutingModule { }
