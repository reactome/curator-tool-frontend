import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainSchemaViewComponent} from "./main-schema-view.component";
import {InstanceModule} from "../instance/instance.module";
import {ListInstancesModule} from "../list-instances/list-instances.module";
import {InstanceViewComponent} from "../instance/components/instance-view/instance-view.component";

const routes: Routes = [
  {
    path: ``,
    component: MainSchemaViewComponent,

  },
  {
    path: `instance`,
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import("../instance/instance.module").then((m) =>
        m.InstanceModule),
  },
  {
    path: `list_instances`,
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import("../list-instances/list-instances.module").then((m) =>
        m.ListInstancesModule),
  },
  {
    path: `class`,
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import("../schema-class/components/table/schema-class-table.module").then((m) =>
        m.SchemaClassTableModule),
  },
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainSchemaViewRoutingModule {
}
