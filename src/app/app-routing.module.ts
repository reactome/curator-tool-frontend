import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GeneLlmComponentComponent } from './gene-llm/gene-llm-component/gene-llm-component.component';
import {InstanceViewComponent} from "./schema-view/instance/components/instance-view/instance-view.component";
import {InstanceModule} from "./schema-view/instance/instance.module";

const routes: Routes = [
  {
    path: "login",
    loadChildren: () =>
      import("./auth/auth.module").then((m) =>
        m.AuthModule),
  },
  {
    path: "home",
    loadChildren: () =>
      import("./home/home.module").then((m) =>
        m.HomeModule),
  },
  {
    path: "schema_view",
    loadChildren: () =>
      import("./schema-view/main-schema-view/main-schema-view.module").then((m) =>
        m.MainSchemaViewModule),
  },
  {
    path: "event_view",
    loadChildren: () =>
      import("./event-view/main-event/main-event.module").then((m) =>
        m.MainEventModule),
  },
  {
    path: "instance_view",
    loadChildren: () =>
      import("./schema-view/instance/instance.module").then((m) =>
        m.InstanceModule),
  },
  {
    path: "llm_apps",
    component: GeneLlmComponentComponent
  },
  {
    path: "",
    // redirectTo: "attribute-table",
    // redirectTo: "instance_view/141429", // To a reaction for the development: https://reactome.org/PathwayBrowser/#/R-HSA-69620&SEL=R-HSA-141429&PATH=R-HSA-1640170
    redirectTo: "login",
    pathMatch: "full",
  },
  { path: '**',
    loadChildren: () =>
      import("./schema-view/schema-class/components/table/schema-class-table.module").then((m) =>
        m.SchemaClassTableModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
