import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {ListInstancesComponent} from "./list-instances.component";

const routes: Routes = [
  {
    path: `:className`,
    component: ListInstancesComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ListInstancesComponent
  ],
  exports: [RouterModule]
})
export class ListInstancesRoutingModule {
}
