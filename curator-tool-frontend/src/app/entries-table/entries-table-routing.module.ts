import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { EntriesTableComponent } from './components/entries-table/entries-table.component';
import {BreadCrumbComponent} from "./components/bread-crumb/bread-crumb.component";
const routes: Routes = [
  {
    path: "",
    component: BreadCrumbComponent
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
