import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GeneLlmRoutingModule } from './gene-llm-routing.module';
import { ConfigurationComponentComponent } from './components/configuration-component/configuration-component.component';
import { GeneLlmComponentComponent } from './gene-llm-component.component';
import { CdkAccordionModule } from '@angular/cdk/accordion';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { EventFilterComponent } from '../event-view/components/event-filter/event_filter.component';
import { PathwayDiagramComponent } from '../event-view/components/pathway-diagram/pathway-diagram.component';
import { PathwayDiagramModule } from '../event-view/components/pathway-diagram/pathway-diagram.module';
import { InstanceBookmarkModule } from '../schema-view/instance-bookmark/instance-bookmark.module';
import { SharedModule } from '../shared/shared.module';
import { NavigationMenuComponent } from './components/navigation-menu/navigation-menu.component';
import { GenePapersComponent } from './components/gene-papers/gene-papers.component';
import { MatTree, MatTreeModule } from '@angular/material/tree';
import { MatProgressBar} from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';

@NgModule({
  declarations: [
    GeneLlmComponentComponent,
    ConfigurationComponentComponent,
    NavigationMenuComponent,
    GenePapersComponent
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
    MatTreeModule,
    MatTree,
    SharedModule,
    MatProgressBar,
    MatTooltip
    // RouterOutlet,
    // AbstractSummaryTableComponent

  ]
})
export class GeneLlmModule { }