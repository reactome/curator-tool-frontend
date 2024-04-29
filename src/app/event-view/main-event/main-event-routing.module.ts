import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainEventComponent} from "./main-event.component";

const routes: Routes = [
  {
    path: `instance`,
    component: MainEventComponent,
    loadChildren: () =>
      import("src/app/instance/instance.module").then((m) =>
        m.InstanceModule),
  },
  {
    path: `graphic-display`,
    component: MainEventComponent,
    loadChildren: () =>
      import("../graphic-display/graphic-display.module").then((m) =>
        m.GraphicDisplayModule),
  },
  {
    path: '',
    component: MainEventComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainEventRoutingModule {}
