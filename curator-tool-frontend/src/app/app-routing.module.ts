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
    path: "entries-table",
    loadChildren: () => 
      import("./entities-table/entities-table.module").then((m) =>
      m.EntitiesTableModule),
  }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
