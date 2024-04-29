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
        m.InstanceModule)
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
