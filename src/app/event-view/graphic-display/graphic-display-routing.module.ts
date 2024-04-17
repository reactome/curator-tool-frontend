import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {EventPlotComponent} from "./components/event-plot/event-plot.component";

const routes: Routes = [
  {
    path: `:dbIdAndClassName`,
    component: EventPlotComponent,
  },
//   {
//     path:`:dbId/:mode`,
//     component: InstanceViewComponent
//   },
//   {
//     path:`:dbId/:mode/:dbId2`,
//     component: InstanceViewComponent
//   },
//   {
//     path: `schemaClass/:className`,
//     component: InstanceViewComponent
//   },
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class GraphicDisplayRoutingModule {
}
