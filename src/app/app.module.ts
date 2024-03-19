import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http'; // importing the http module
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from "@angular/router";
import { EffectsModule } from '@ngrx/effects';
import { routerReducer, StoreRouterConnectingModule } from '@ngrx/router-store';
import {ActionReducer, MetaReducer, StoreModule} from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from 'src/environments/environment.dev';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ListInstancesModule } from "./list-instances/list-instances.module";
import { MainModule } from "./main/main.module";
import { SchemaClassTableModule } from './schema-class/components/table/schema-class-table.module';
import { SharedModule } from "./shared/shared.module";
import { StatusModule } from './status/status.module';
import { CustomSerializer } from "./store/custom-serializer";
import {localStorageSync} from "ngrx-store-localstorage";
import {LoginComponent} from "./auth/login/login.component";
import {HomeModule} from "./home/home.module";
import { GeneLlmComponentComponent } from './gene-llm/gene-llm-component/gene-llm-component.component';
import {AuthModule} from "./auth/auth.module";
import {HeaderInterceptor} from "./core/interceptors/header.interceptor";
import {JwtModule} from "@auth0/angular-jwt";

export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({
    keys: ['bookmark'],
    rehydrate: true,})(reducer);}

const metaReducers: Array<MetaReducer<any, any>> = [localStorageSyncReducer]

export function tokenGetter() {
  return localStorage.getItem("token");
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    SchemaClassTableModule,
    ListInstancesModule,
    EffectsModule.forRoot(),
    StoreModule.forRoot({router: routerReducer}, {metaReducers}),
    RouterModule.forRoot([]),
    StoreRouterConnectingModule.forRoot({serializer: CustomSerializer,}),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
      autoPause: true,
    }),
    SharedModule,
    MainModule,
    StatusModule,
    HomeModule,
    GeneLlmComponentComponent,
    AuthModule,
    JwtModule.forRoot({ // for JwtHelperService
      config: {
        tokenGetter
      }
    })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: HeaderInterceptor, multi: true }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
