import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";
import { MatMenuModule } from '@angular/material/menu';
import {InstanceTableComponent} from "./components/instance-view/instance-table/instance-table.component";

const routes: Routes = [
  {
    path: `:dbId`,
    component: InstanceViewComponent
  },
  {
    path: `:dbId/:viewOnly`,
    component: InstanceTableComponent
  },
  {
    path: `schemaClass/:className`,
    component: InstanceViewComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class DatabaseObjectRoutingModule {
}
