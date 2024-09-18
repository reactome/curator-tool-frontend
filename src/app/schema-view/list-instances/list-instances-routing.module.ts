import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListInstancesViewComponent } from "./components/list-instances-view/list-instances-view.component";

const routes: Routes = [
  {
    path: `:className`,
    component: ListInstancesViewComponent,
  },
  {
    path: `:className/:skip/:limit`,
    component: ListInstancesViewComponent,
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
