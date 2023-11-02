import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {ListInstancesViewComponent} from "./components/list-instances-view/list-instances-view.component";

const routes: Routes = [
  {
    path: `:className`,
    component: ListInstancesViewComponent
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
