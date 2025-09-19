import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from "@angular/router";
import { MainSchemaViewComponent } from "./main-schema-view.component";

/**
 * Use the child routes so that we can use the same instanceof of MainSchemaViewComponent and avoid refresh
 * the schema tree therefore to keep the scroll location (e.g. the user scrolls to the bottom, choose list instance,
 * or create instance, or view schema, the scroll position will stay.)
 */
const routes: Routes = [
  {
    path: '',
    component: MainSchemaViewComponent,
    children: [

      {
        path: 'instance',
        loadChildren: () =>
          import('../../instance/instance.module').then(m => m.InstanceModule),
      },
      {
        path: 'class',
        loadChildren: () =>
          import('../schema-class/components/table/schema-class-table.module').then(m => m.SchemaClassTableModule),
      },
            {
        path: 'list_instances',
        loadChildren: () =>
          import('../list-instances/list-instances.module').then(m => m.ListInstancesModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('./text-curation/text-curation.module').then(m => m.TextCurationModule),
        pathMatch: 'full'
      },
    ]
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainSchemaViewRoutingModule {
}
