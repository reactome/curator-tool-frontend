import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstanceListViewComponent } from "./components/list-instances-view/instance-list/instance-list-view.component";

// Define routes as a constant inside the module, not exported, and use RouterModule.forChild(routes)
// This makes the routes scoped only to this module/component.
const routes: Routes = [
  // Without source
  { path: ':className', component: InstanceListViewComponent },
  { path: ':className/:skip/:limit', component: InstanceListViewComponent },
  // With source
  // { path: 'source/:source/:className', component: InstanceListViewComponent },
  // { path: 'source/:source/:className/:skip/:limit', component: InstanceListViewComponent },
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
