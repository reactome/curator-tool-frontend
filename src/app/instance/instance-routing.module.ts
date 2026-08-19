import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";
import {ReferrersPageComponent} from "./components/referrers-page/referrers-page.component";

const routes: Routes = [
  {
    path: ':dbId/:mode/:dbId2',
    component: InstanceViewComponent
  },
  // Declared before the bare ':dbId' route so that the literal 'referrers' segment is not
  // swallowed as an instance id. This is the stable, bookmarkable URL for an instance's
  // referrers, the routed counterpart of ReferrersDialogComponent.
  {
    path: ':dbId/referrers',
    component: ReferrersPageComponent,
  },
  // //Somehow this conflicts with list_instance/classname/skip/limit
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
