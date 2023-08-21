import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";
import {EntriesTableComponent} from "./components/entries-table/entries-table.component";
const routes: Routes = [
  {
    path: `:dbId`,
    component: InstanceViewComponent
  },
  {
    path: `schemaClass/:className`,
    component: EntriesTableComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports:[RouterModule]
})
export class EntriesTableRoutingModule { }
