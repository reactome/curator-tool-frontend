import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: "",
    redirectTo: "schema-class-table",
    pathMatch: "full",
  },
  {
    path: "schema-class-table",
    loadChildren: () =>
      import("./schema-class-table/schema-class-table.module").then((m) =>
          m.SchemaClassTableModule),
  },
  {
    path: "instance-table",
    loadChildren: () =>
      import("./database-object-view/database-object.module").then((m) =>
      m.DatabaseObjectModule),
  }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
