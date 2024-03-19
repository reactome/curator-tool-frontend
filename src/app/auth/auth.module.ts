import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MaterialModule} from "../material/material.module";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import { LoginComponent } from './login/login.component';
import {AuthRoutingModule} from "./auth-routing.module";
import {AuthFormComponent} from "./components/auth-form/auth-form.component";
import {ActionReducer, MetaReducer, StoreModule} from "@ngrx/store";
import {localStorageSync} from "ngrx-store-localstorage";
import {EffectsModule} from "@ngrx/effects";
import {AuthEffects} from "./state/auth.effects";
import {authReducer} from "./state/auth.reducers";

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
    AuthRoutingModule,
    StoreModule.forFeature('authState', authReducer, {metaReducers}),
    EffectsModule.forFeature([AuthEffects]),
  ]
})
export class AuthModule {}
