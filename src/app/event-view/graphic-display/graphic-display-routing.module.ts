import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {EventPlotComponent} from "./components/event-plot/event-plot.component";

const routes: Routes = [
  {
    path: `:dbIdAndClassName`,
    component: EventPlotComponent,
  },
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class GraphicDisplayRoutingModule {
}
