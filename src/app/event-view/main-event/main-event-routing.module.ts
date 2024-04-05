import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainEventComponent} from "./main-event.component";
import {MainSchemaViewComponent} from "../../schema-view/main-schema-view/main-schema-view.component";

const routes: Routes = [
  {
    path: `instance`,
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import("../../schema-view/instance/instance.module").then((m) =>
        m.InstanceModule),
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
