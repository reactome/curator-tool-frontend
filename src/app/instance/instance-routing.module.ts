import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {InstanceViewComponent} from "./components/instance-view/instance-view.component";

const routes: Routes = [
  {
    path: ':dbId/:mode/:dbId2',
    component: InstanceViewComponent
  },
  // The referrers page now lives at schema_view/referrers/:dbId (see ReferrersPageModule).
  // Kept so URLs shared or bookmarked before the move still resolve. Declared before the bare
  // ':dbId' route so that the literal 'referrers' segment is not swallowed as an instance id.
  {
    path: ':dbId/referrers',
    redirectTo: '/schema_view/referrers/:dbId',
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
