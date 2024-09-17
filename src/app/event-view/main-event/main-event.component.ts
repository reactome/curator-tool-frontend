import { CdkDragMove } from "@angular/cdk/drag-drop";
import { Component, ViewChild } from '@angular/core';
import { MatSidenav } from "@angular/material/sidenav";
import { ReactomeEventTypes } from 'ngx-reactome-cytoscape-style';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { InstanceViewComponent } from 'src/app/instance/components/instance-view/instance-view.component';
import { EventTreeComponent } from '../components/event-tree/event-tree.component';
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';

@Component({
  selector: 'app-main-schema-view-event-view',
  templateUrl: './main-event.component.html',
  styleUrls: ['./main-event.component.scss'],
})
export class MainEventComponent {
  sideWidth = 400;
  diagramHeight = 850;
  schemaPanelOpen = false;
  resizingVertical: boolean = false;
  resizingHorizontal: boolean = false;
  showChanged: boolean = false;
  status = {closed: true, opened: false, dragging: false};

  @ViewChild('sidenav') sidenav: MatSidenav | undefined;
  @ViewChild('diagramView') diagramView: PathwayDiagramComponent | undefined;
  @ViewChild('instanceView') instanceView: InstanceViewComponent | undefined;
  @ViewChild('eventTree') eventTree: EventTreeComponent | undefined;

  // Track diagram selection ids to avoid unncessary update
  private selectedIdsInDiagram: number[] = [];

  constructor(private instanceUtilities: InstanceUtilities) {
    this.instanceUtilities.lastClickedDbId$.subscribe(dbId => {
      // Avoid using ngrx to avoid the complicated implementation
      this.instanceView?.loadInstance(parseInt(dbId + ''));
    });
  }

  ngAfterViewInit(): void {
    // Here we use a quite direct approach instead of using Angular output pattern
    // to make it easier
    this.diagramView?.diagram.reactomeEvents$.subscribe(event => {
      this.handleDiagramSelection(event);
    });
  }

  openSidenav() {
    this.sidenav?.open();
  }

  closeSidenav() {
    this.sidenav?.close();
  }

  resizeLeft(e: CdkDragMove) {
    this.sideWidth = e.pointerPosition.x
  }


  resizeDown(e: CdkDragMove) {
    this.diagramHeight = e.pointerPosition.y
  }

  showUpdatedInstances(showList: boolean) {
    this.showChanged = !this.showChanged; 
  }

  onDrag() {
    this.status.opened = false;
    this.status.closed = false;
    this.status.dragging = true;
  }

  onDragEnd() {
    setTimeout(() => {
      this.status.dragging = false;
    }, 5)
  }

  toggleBookmarks() {
    setTimeout(() => {
      if (this.status.dragging) return;
      this.status.opened = !this.status.opened;
      this.status.closed = !this.status.opened;
    })
  }

  addEventToDiagram(instance: Instance) {
    this.diagramView?.addEvent(instance);
  }

  handleEventClicked(dbId: any) {
    this.diagramView?.selectObjectsInDiagram(dbId);
    this.instanceView?.loadInstance(dbId);
    this.instanceView?.resetViewHistory();
  }

  handleSpeciesSelection(species: string) {
    this.eventTree?.selectSpecies(species);
  }

  handleEventFilterTextChanged(text: string) {
    this.eventTree?.filterEvents(text);
  }

  /**
   * This method is adopted from diagramSelect2state in diagram.component.ts in ngx-reactome-base.
   * @param event
   * @returns
   */
  //TODO: If nothing is selected, we need to make sure the pathway for the diagram
  // is shown in the instance view.
  handleDiagramSelection(event: any) {
    if (event.type !== ReactomeEventTypes.select)
      return;
    // Get the dbId from the selected elements
    let reactomeIds = event.detail.element.map((el: any) => el.data('reactomeId'));
    // Make sure reactomeIds don't contain duplicated element
    const uniqueSet = new Set(reactomeIds);
    reactomeIds = Array.from(uniqueSet).sort();
    if (reactomeIds.length === 0) {
      this.selectedIdsInDiagram = reactomeIds;
      return;
    }
    if (reactomeIds.length === this.selectedIdsInDiagram.length &&
        reactomeIds.every((value: number, index: number) => value === this.selectedIdsInDiagram[index]))
      return; // They are the same
    this.selectedIdsInDiagram = reactomeIds;
    this.instanceView?.loadInstance(reactomeIds[0]);
    this.instanceView?.resetViewHistory();
    this.eventTree?.selectNodesForDiagram(reactomeIds[0]);
  }

  protected readonly window = window;
}
