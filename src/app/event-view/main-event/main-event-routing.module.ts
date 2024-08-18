import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainEventComponent} from "./main-event.component";

const routes: Routes = [
  {
    path: `instance/:id`,
    component: MainEventComponent,
  },
  {
    path: ``,
    // Use this for the time being. Most likely we should not use.
    redirectTo: 'instance/0', // Redirect so that MainEventComponent is not reloaded
    pathMatch: 'full',
    // component: MainEventComponent,
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
