import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http'; // importing the http module

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SchemaClassTableModule} from './schema-class/components/table/schema-class-table.module';
import {DatabaseObjectModule} from './instance/instance.module';
import {StoreModule} from '@ngrx/store';
import {StoreDevtoolsModule} from '@ngrx/store-devtools';
import {environment} from 'src/environments/environment.dev';
import {EffectsModule} from '@ngrx/effects';
import {RouterModule} from "@angular/router";
import {routerReducer, StoreRouterConnectingModule} from '@ngrx/router-store';
import {CustomSerializer} from "./store/custom-serializer";
import {
  SchemaClassTableComponent
} from "./schema-class/components/table/components/attributeTable/schema-class-table.component";
import {SharedModule} from "./shared/shared.module";

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SchemaClassTableComponent,
    HttpClientModule,
    SchemaClassTableModule,
    DatabaseObjectModule,
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
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {
}
