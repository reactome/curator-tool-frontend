import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GeneLlmRoutingModule } from './gene-llm-routing.module';
import { ConfigurationComponentComponent } from './gene-llm-component/configuration-component/configuration-component.component';
import { AbstractSummaryTableComponent } from './gene-llm-component/abstract-summary-table/abstract-summary-table.component';
import { GeneLlmComponentComponent } from './gene-llm-component/gene-llm-component.component';
import { RouterOutlet } from '@angular/router';

@NgModule({
  declarations: [
    GeneLlmComponentComponent,
    ConfigurationComponentComponent,
    AbstractSummaryTableComponent
  ],
  exports: [
    // GeneLlmComponentComponent,
    // ConfigurationComponentComponent,
    // AbstractSummaryTableComponent
  ],
  imports: [
    CommonModule,
    GeneLlmRoutingModule,
    // ConfigurationComponentComponent,
    // RouterOutlet,
    // AbstractSummaryTableComponent

  ]
})
export class GeneLlmModule {}