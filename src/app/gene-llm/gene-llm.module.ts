import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GeneLlmRoutingModule } from './gene-llm-routing.module';
import { ConfigurationComponentComponent } from './gene-llm-component/configuration-component/configuration-component.component';
import { AbstractSummaryTableComponent } from './gene-llm-component/abstract-summary-table/abstract-summary-table.component';
import { GeneLlmComponentComponent } from './gene-llm-component.component';
import { RouterOutlet } from '@angular/router';
import { CdkAccordionModule } from '@angular/cdk/accordion';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { EventFilterComponent } from '../event-view/components/event-filter/event_filter.component';
import { EventTreeModule } from '../event-view/components/event-tree/event-tree.module';
import { PathwayDiagramComponent } from '../event-view/components/pathway-diagram/pathway-diagram.component';
import { PathwayDiagramModule } from '../event-view/components/pathway-diagram/pathway-diagram.module';
import { MainEventRoutingModule } from '../event-view/main-event/main-event-routing.module';
import { InstanceModule } from '../instance/instance.module';
import { InstanceBookmarkModule } from '../schema-view/instance-bookmark/instance-bookmark.module';
import { SharedModule } from '../shared/shared.module';
import { UpdatedInstanceListComponent } from '../status/components/updated-instance-list/updated-instance-list.component';
import { StatusComponent } from '../status/status.component';

@NgModule({
  declarations: [
    GeneLlmComponentComponent,
    AbstractSummaryTableComponent
  ],
  exports: [
    GeneLlmComponentComponent,
  ],
  imports: [
    CommonModule,
    GeneLlmRoutingModule,
    CdkDrag,
    MatSidenavModule,
    MatToolbarModule,
    CdkAccordionModule,
    InstanceBookmarkModule,
    CdkDragHandle,
    MatGridListModule,
    PathwayDiagramComponent,
    SharedModule,
    EventFilterComponent,
    PathwayDiagramModule,
    // ConfigurationComponentComponent,
    // RouterOutlet,
    // AbstractSummaryTableComponent

  ]
})
export class GeneLlmModule { }