import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GeneLlmComponentComponent } from './gene-llm/gene-llm-component/gene-llm-component.component';

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
      import("./main/main.module").then((m) =>
        m.MainModule),
  },
  {
    path: "event_view",
    loadChildren: () =>
      import("./main-event/main-event.module").then((m) =>
        m.MainEventModule),
  },
  {
    path: "table",
    loadChildren: () =>
      import("./schema-class/components/table/schema-class-table.module").then((m) =>
          m.SchemaClassTableModule),
  },
  {
    path: "event_table",
    loadChildren: () =>
      import("./event/components/table/event-table.module").then((m) =>
        m.EventTableModule),
  },
  {
    path: "list_instances",
    loadChildren: () =>
      import("./list-instances/list-instances.module").then((m) =>
        m.ListInstancesModule),
  },
  {
    path: "instance_view",
    loadChildren: () =>
      import("./instance/instance.module").then((m) =>
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
    redirectTo: "home",
    pathMatch: "full",
  },
  { path: '**',
    loadChildren: () =>
      import("./schema-class/components/table/schema-class-table.module").then((m) =>
        m.SchemaClassTableModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
