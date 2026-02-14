import { CdkDragMove } from "@angular/cdk/drag-drop";
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from "@angular/material/sidenav";
import { ReactomeEventTypes } from 'ngx-reactome-cytoscape-style';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { InstanceViewComponent } from 'src/app/instance/components/instance-view/instance-view.component';
import { EventTreeComponent } from '../components/event-tree/event-tree.component';
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';
import { Subscription } from "rxjs";

@Component({
  selector: 'app-main-schema-view-event-view',
  templateUrl: './main-event.component.html',
  styleUrls: ['./main-event.component.scss'],
})
export class MainEventComponent implements  OnInit, OnDestroy {
  // TODO: calculate window/screden size and make the table a ratio. 
  treeWidth = 400;
  diagramHeight = window.innerHeight * 0.67;
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

  private subscriptions: Subscription = new Subscription();

  constructor(private instanceUtilities: InstanceUtilities) {
    let sub = this.instanceUtilities.lastClickedDbId$.subscribe(dbId => {
      // Avoid using ngrx to avoid the complicated implementation
      this.instanceView?.loadInstance(parseInt(dbId + ''));
    });
    this.subscriptions.add(sub);
    sub = this.instanceUtilities.lastClickedDbIdForComparison$.subscribe((dbId: number) => {
      // Avoid using ngrx to avoid the complicated implementation
      this.instanceView?.loadInstance(dbId, true);
    });
    this.subscriptions.add(sub);    
    sub = this.instanceUtilities.lastUpdatedInstance$.subscribe(data => {
      if (data.instance) {
        this.instanceView?.loadInstance(data.instance.dbId, false, false, true, false);
      }
    });
    this.subscriptions.add(sub);
  }

  ngAfterViewInit(): void {
    // Here we use a quite direct approach instead of using Angular output pattern
    // to make it easier
    let sub = this.diagramView?.diagram.reactomeEvents$.subscribe(event => {
      this.handleDiagramSelection(event);
    });
    if (sub) {
      this.subscriptions.add(sub);
    } 
  }

  ngOnInit(): void {
    // Restore the state from localStorage
    const savedState = sessionStorage.getItem('statusPaneInEventView');
    this.showChanged = savedState === 'shown' ? true : false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  openSidenav() {
    this.sidenav?.open();
  }

  closeSidenav() {
    this.sidenav?.close();
  }

  resizeLeft(e: CdkDragMove) {
    this.treeWidth = e.pointerPosition.x
  }

  resizeDown(e: CdkDragMove) {
    this.diagramHeight = e.pointerPosition.y
  }

  showUpdatedInstances(showList: boolean) {
    this.showChanged = !this.showChanged; 
    sessionStorage.setItem('statusPaneInEventView', this.showChanged ? 'shown' : 'hidden');
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
    this.instanceView?.loadInstance(dbId, false, true);
  }

  handleSpeciesSelection(species: string) {
    this.eventTree?.selectSpecies(species);
  }

  handleEventFilterTextChanged(text: string) {
    this.eventTree?.filterEvents(text);
  }

  createEmptyDiagram(pathwayId: number) {
    this.diagramView?.createEmptyDiagram(pathwayId);
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
    // Escape the action if event.details.element's edgeType is flowLine.
    if (event.detail.element && event.detail.element.length > 0 && event.detail.element[0].data('edgeType') === 'flowLine')
      return;
    // Get the dbId from the selected elements
    let reactomeIds = event.detail.element.map((el: any) => el.data('reactomeId')).filter((id : any) => (id !== undefined && id !== null))
    
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
    // Make sure the first selected element is valid
    if (reactomeIds[0].toString().includes('-'))
      return;
    this.instanceView?.loadInstance(reactomeIds[0], false, true);
    this.eventTree?.selectNodesForDiagram(reactomeIds[0]);
  }

  handleOpenPathwayDiagramEvent(pathwayId: number) {
    this.instanceView?.loadInstance(pathwayId, false, true);
  }

  handleGoToPathEvent(dbId: number) {
    // this.instanceView?.loadInstance(dbId, false, true);
    this.eventTree?.goToPathway(undefined, dbId);
  }

  protected readonly window = window;
}
