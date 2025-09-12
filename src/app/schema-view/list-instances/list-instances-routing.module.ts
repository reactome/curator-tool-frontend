import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list-view.component";

const routes: Routes = [
  {
    path: `:className`,
    component: InstanceListViewComponent,
  },
  {
    path: `:className/:skip/:limit`,
    component: InstanceListViewComponent,
  },
  {
    path: `local/:className/:skip/:limit`,
    component: InstanceListViewComponent,
  },
  // The following route should not be used! It confuses with the above, second route!
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
