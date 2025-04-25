import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GeneLlmRoutingModule } from './gene-llm-routing.module';
import { ConfigurationComponentComponent } from './components/configuration-component/configuration-component.component';
import { ProteinPartnersTableComponent } from './components/protein-partners-table/protein-partners-table.component';
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
import { MatExpansionPanel, MatExpansionPanelDescription, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { AnnotatedPathwayDetailsComponent } from './components/annotated-pathway-details/annotated-pathway-details.component';
import { NavigationMenuComponent } from './components/navigation-menu/navigation-menu.component';
import { MatTree, MatTreeModule } from '@angular/material/tree';

@NgModule({
  declarations: [
    GeneLlmComponentComponent,
    ProteinPartnersTableComponent,
    ConfigurationComponentComponent,
    AnnotatedPathwayDetailsComponent, 
    NavigationMenuComponent
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
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
    MatTreeModule,
    MatTree,
    SharedModule,
    // RouterOutlet,
    // AbstractSummaryTableComponent

  ]
})
export class GeneLlmModule { }