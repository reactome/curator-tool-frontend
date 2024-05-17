import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainEventComponent} from "./main-event.component";

const routes: Routes = [
  {
    path: `instance/:id`,
    component: MainEventComponent,
    loadChildren: () =>
      import("src/app/instance/instance.module").then((m) =>
        m.InstanceModule)
  },
  {
    path: ``,
    component: MainEventComponent,
    loadChildren: () =>
      import("src/app/schema-view/main-schema-view/text-curation/text-curation.module").then(m =>
        m.TextCurationModule)
  },
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class MainEventRoutingModule {}
