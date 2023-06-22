import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http'; // importing the http module

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AttributeTableComponent } from './attribute-table/pages/attributeTable/attribute-table.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { EntriesTableComponent } from './entities-table/components/entries-table/entries-table.component';
import { AttributeTableModule } from './attribute-table/attribute-table.module';
import { EntitiesTableModule } from './entities-table/entities-table.module';

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
    EntriesTableComponent,
    AttributeTableModule,
    EntitiesTableModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
