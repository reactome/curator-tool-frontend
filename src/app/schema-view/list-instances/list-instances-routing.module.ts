import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {ListInstancesViewComponent} from "./components/list-instances-view/list-instances-view.component";

const routes: Routes = [
  {
    path: `:className`,
    component: ListInstancesViewComponent,
    // children: [{
    //   path: `:attributes/:regex/:searchKey`,
    //   component: ListInstancesViewComponent
    // }]
  },
  {
    path: `:className/:attributes/:regex/:searchKey`,
    component: ListInstancesViewComponent,
    title: 'FilterSearch',
  }

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
