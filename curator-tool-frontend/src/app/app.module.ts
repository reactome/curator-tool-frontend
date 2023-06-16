import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http'; // importing the http module

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AttributeTableComponent } from './attribute-table/pages/attributeTable/attribute-table.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { EntriesTableComponent } from './attribute-table/pages/entries-table/entries-table.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    AttributeTableComponent,
    HttpClientModule,
    EntriesTableComponent

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
