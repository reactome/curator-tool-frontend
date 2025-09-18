import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list/instance-list-view.component";

const routes: Routes = [
  { path: ':source/:className', component: InstanceListViewComponent },
  { path: ':source/:className/:skip/:limit', component: InstanceListViewComponent },
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ListInstancesRoutingModule {
}
