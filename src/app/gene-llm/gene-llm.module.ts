import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GeneLlmRoutingModule } from './gene-llm-routing.module';
import { ConfigurationComponentComponent } from './gene-llm-component/configuration-component/configuration-component.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    NgModule,
    GeneLlmRoutingModule,
    ConfigurationComponentComponent,
  ]
})
export class GeneLlmModule { }
