import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from "@angular/router";
import { MainSchemaViewComponent } from "./main-schema-view.component";

const routes: Routes = [
  {
    path: `instance`,
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import("src/app/instance/instance.module").then((m) =>
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
  {
    path: '',
    component: MainSchemaViewComponent,
    loadChildren: () =>
      import('./text-curation/text-curation.module').then(m =>
        m.TextCurationModule),
    // redirectTo: 'llm/*',
    // pathMatch: 'full',
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
