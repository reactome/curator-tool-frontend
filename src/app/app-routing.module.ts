import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: "",
    // redirectTo: "attribute-table",
    redirectTo: "instance_view/141429", // To a reaction for the development: https://reactome.org/PathwayBrowser/#/R-HSA-69620&SEL=R-HSA-141429&PATH=R-HSA-1640170
    pathMatch: "full",
  },
  {
    path: "schema-class-table",
    loadChildren: () =>
      import("./schema-class-table/schema-class-table.module").then((m) =>
          m.SchemaClassTableModule),
  },
  {
    path: "instance_view",
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
