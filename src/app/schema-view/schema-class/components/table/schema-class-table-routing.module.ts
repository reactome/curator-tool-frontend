import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {SchemaClassTableComponent} from './schema-class-table.component';

const routes: Routes = [
  {
    path: `:className`,
    component: SchemaClassTableComponent
  }
]
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    SchemaClassTableComponent
  ],
  exports: [RouterModule]
})
export class SchemaClassTableRoutingModule {
}
