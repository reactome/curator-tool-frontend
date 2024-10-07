import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http'; // importing the http module
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy, RouterModule } from "@angular/router";
import { JwtModule } from "@auth0/angular-jwt";
import { EffectsModule } from '@ngrx/effects';
import { routerReducer } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { DIAGRAM_CONFIG_TOKEN } from 'ngx-reactome-diagram';
import { environment } from 'src/environments/environment.dev';
import { AppRoutingModule, routes } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthModule } from "./auth/auth.module";
import { HeaderInterceptor } from "./core/interceptors/header.interceptor";
import { MainEventModule } from "./event-view/main-event/main-event.module";
import { GeneLlmComponentComponent } from './gene-llm/gene-llm-component/gene-llm-component.component';
import { HomeModule } from "./home/home.module";
import { InstanceEffects } from './instance/state/instance.effects';
import { BookmarkEffects } from "./schema-view/instance-bookmark/state/bookmark.effects";
import { ListInstancesModule } from "./schema-view/list-instances/list-instances.module";
import { MainSchemaViewModule } from "./schema-view/main-schema-view/main-schema-view.module";
import { SchemaClassTableModule } from './schema-view/schema-class/components/table/schema-class-table.module';
import { SharedModule } from "./shared/shared.module";
import { StatusModule } from './status/status.module';
import { CustomReuseStrategy } from './custom-reuse-strategy';
// import { CustomSerializer } from "./store/custom-serializer";

export function tokenGetter() {
  return localStorage.getItem("token");
}

// diagram configuration
const diagramServiceConfig = {
  // diagramUrl: 'https://dev.reactome.org/download/current/diagram'
  diagramUrl: environment.ApiRoot + '/diagram'
}

// Set a longer default delay to avoid showing tooltip to avoid annoying the user
const customTooltipOptions: MatTooltipDefaultOptions = {
  showDelay: 500,
  hideDelay: 500,
  touchendHideDelay: 500,
};

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
    EffectsModule.forRoot([BookmarkEffects, InstanceEffects]),
    RouterModule.forRoot([]),
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
    }),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: HeaderInterceptor, multi: true },
    {provide: DIAGRAM_CONFIG_TOKEN, useValue: diagramServiceConfig},
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: customTooltipOptions }  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
