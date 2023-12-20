import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";

const routes: Routes = [
  {
    path: `:dbId`,
    component: InstanceViewComponent,
  },
  {
    path:`:dbId/:mode`,
    component: InstanceViewComponent
  },
  {
    path:`:dbId/:mode/:dbId2`,
    component: InstanceViewComponent
  },
  {
    path: `schemaClass/:className`,
    component: InstanceViewComponent
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
export class DatabaseObjectRoutingModule {
}
