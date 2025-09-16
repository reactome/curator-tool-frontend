import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list-view.component";

const routes: Routes = [
  { path: 'local/:className/:skip/:limit', component: InstanceListViewComponent },
  { path: 'local/:className', component: InstanceListViewComponent },
  { path: ':className/:skip/:limit', component: InstanceListViewComponent },
  { path: ':className', component: InstanceListViewComponent }
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
