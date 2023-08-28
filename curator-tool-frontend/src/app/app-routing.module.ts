import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: "",
    redirectTo: "attribute-table",
    pathMatch: "full",
  },
  {
    path: "attribute-table",
    loadChildren: () =>
      import("./attribute-table/attribute-table.module").then((m) =>
          m.AttributeTableModule),
  },
  {
    path: "properties-table",
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
