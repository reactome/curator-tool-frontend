import { HttpClientModule } from '@angular/common/http'; // importing the http module
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from "@angular/router";
import { EffectsModule } from '@ngrx/effects';
import { routerReducer, StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
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
import {CookieService} from "ngx-cookie-service";

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
    StoreModule.forRoot({router: routerReducer}),
    RouterModule.forRoot([]),
    StoreRouterConnectingModule.forRoot({serializer: CustomSerializer,}),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
      autoPause: true,
    }),
    SharedModule,
    MainModule,
    StatusModule
  ],
  providers: [CookieService],
  bootstrap: [AppComponent],
})
export class AppModule {
}
