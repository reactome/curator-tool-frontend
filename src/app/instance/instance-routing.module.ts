import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";

const routes: Routes = [
  {
    path: ':dbId/:mode/:dbId2',
    component: InstanceViewComponent
  },
  // Somehow this conflicts with list_instance/classname/skip/limit
  // {
  //   path: `:dbId/:mode`,
  //   component: InstanceViewComponent,
  // },
  {
    path: `:dbId`,
    component: InstanceViewComponent,
  },
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class InstanceRoutingModule {
}
