import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GeneLlmComponentComponent } from './gene-llm/gene-llm-component.component';
import { authGuard } from './core/services/authenticate.service';

export const routes: Routes = [
  {
    path: "login",
    loadChildren: () =>
      import("./auth/auth.module").then((m) => m.AuthModule),
  },
  {
    path: "home",
    loadChildren: () =>
      import("./home/home.module").then((m) => m.HomeModule),
    canActivate: [authGuard], // Protect the route
  },
  {
    path: "schema_view",
    loadChildren: () =>
      import("./schema-view/main-schema-view/main-schema-view.module").then(
        (m) => m.MainSchemaViewModule
      ),
    canActivate: [authGuard], // Protect the route
  },
  {
    path: "event_view",
    loadChildren: () =>
      import("./event-view/main-event/main-event.module").then(
        (m) => m.MainEventModule
      ),
    canActivate: [authGuard], // Protect the route
  },
  {
    path: "llm_apps_view",
    component: GeneLlmComponentComponent,
    canActivate: [authGuard], // Protect the route
  },
  {
    path: "",
    redirectTo: "login",
    pathMatch: "full",
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
