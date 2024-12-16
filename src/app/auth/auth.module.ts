import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from "../shared/material/material.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LoginComponent } from './login/login.component';
import { AuthRoutingModule } from "./auth-routing.module";
import { AuthFormComponent } from "./components/auth-form/auth-form.component";
import { ActionReducer, MetaReducer } from "@ngrx/store";
import { localStorageSync } from "ngrx-store-localstorage";

export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({keys: ['token']})(reducer);
}
const metaReducers: Array<MetaReducer<any, any>> = [localStorageSyncReducer];
@NgModule({
  declarations: [LoginComponent, AuthFormComponent],
  exports: [
    LoginComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AuthRoutingModule
  ]
})
export class AuthModule {}
