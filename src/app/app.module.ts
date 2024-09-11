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
import { ListInstancesModule } from "./schema-view/list-instances/list-instances.module";
import { MainSchemaViewModule } from "./schema-view/main-schema-view/main-schema-view.module";
import { SchemaClassTableModule } from './schema-view/schema-class/components/table/schema-class-table.module';
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
import {MainEventModule} from "./event-view/main-event/main-event.module";
import { DIAGRAM_CONFIG_TOKEN } from 'ngx-reactome-diagram';
import {appReducer} from "./store/app.reducer";
import {AppEffects} from "./store/app.effects";

export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({
    keys: ['bookmark'],
    rehydrate: true,})(reducer);}

const metaReducers: Array<MetaReducer<any, any>> = [localStorageSyncReducer]

export function tokenGetter() {
  return localStorage.getItem("token");
}

// diagram configuration
const diagramServiceConfig = {
  // diagramUrl: 'https://dev.reactome.org/download/current/diagram'
  diagramUrl: environment.ApiRoot + '/diagram'
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
    StoreModule.forRoot({ app: appReducer }),
    EffectsModule.forRoot([AppEffects]),
    RouterModule.forRoot([]),
    StoreRouterConnectingModule.forRoot({serializer: CustomSerializer,}),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
      autoPause: true,
    }),
    SharedModule,
    MainSchemaViewModule,
    MainEventModule,
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
    { provide: HTTP_INTERCEPTORS, useClass: HeaderInterceptor, multi: true },
    {provide: DIAGRAM_CONFIG_TOKEN, useValue: diagramServiceConfig},
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
