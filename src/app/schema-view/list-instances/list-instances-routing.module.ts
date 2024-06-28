import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule, ɵnormalizeQueryParams} from '@angular/common';
import {ListInstancesViewComponent} from "./components/list-instances-view/list-instances-view.component";
import { RouterTestingHarness } from '@angular/router/testing';

const routes: Routes = [
  {
    path: `:className`,
    component: ListInstancesViewComponent,
  },
  {
    path: `:className/:skip/:limit`,
    component: ListInstancesViewComponent,
  },
  // {
  //   path: `:className/:attributes/:operands/:searchKey`,
  //   component: ListInstancesViewComponent,
  //   title: 'FilterSearch',
  // }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ListInstancesRoutingModule {
}
