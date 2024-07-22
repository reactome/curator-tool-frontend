import {Component, ViewChild, Input, AfterViewInit} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {EventPlotComponent} from "../graphic-display/components/event-plot/event-plot.component";
import {ActivatedRoute} from "@angular/router";
import {delay, map} from "rxjs/operators";
import {DiagramComponent} from "ngx-reactome-diagram";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';
import { InstanceViewComponent } from 'src/app/instance/components/instance-view/instance-view.component';
import { Subscription } from 'rxjs';
import { ReactomeEventTypes } from 'ngx-reactome-cytoscape-style';

@Component({
  selector: 'app-main-schema-view-event-view',
  templateUrl: './main-event.component.html',
  styleUrls: ['./main-event.component.scss'],
})
export class MainEventComponent {
  sideWidth = 400;
  schemaPanelOpen = false;
  resizing: boolean = false;
  showInstanceList: number = 0;
  status = {closed: true, opened: false, dragging: false};

  @ViewChild('sidenav') sidenav: MatSidenav | undefined;
  @ViewChild('diagramView') diagramView: PathwayDiagramComponent | undefined;
  @ViewChild('instanceView') instanceView: InstanceViewComponent | undefined;

  constructor() {
  }

  ngAfterViewInit(): void {
    // Here we use a quite direct approach instead of using Angular output pattern
    // to make it easier
    this.diagramView?.diagram.reactomeEvents$.subscribe(event => {
      this.handleDiagramSelection(event);
    });
    this.diagramView?.id$.subscribe(id => {
      this.handleDiagramIdChange(id);
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

  showUpdatedInstances(showList: boolean) {
    console.log(showList);
    if (showList) {
      this.showInstanceList = 1
    } else {
      this.showInstanceList = 0;
    }
  }

  onDrag() {
    this.status.opened = false;
    this.status.closed = false;
    this.status.dragging = true;
    console.log('start')
  }

  onDragEnd() {
    setTimeout(() => {
      console.log('end')
      this.status.dragging = false;
    }, 5)
  }

  toggleBookmarks() {
    setTimeout(() => {

      console.log('toggle')
      if (this.status.dragging) return;
      this.status.opened = !this.status.opened;
      this.status.closed = !this.status.opened;
    })
  }

  handleContextMenu(event: any) {
    console.log('context menu');
  }

  addEventToDiagram(instance: Instance) {
    this.diagramView?.addEvent(instance);
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
    if (reactomeIds.length === 0)
      return;
    this.instanceView?.loadInstance(reactomeIds[0]);
  }

  /**
   * Switch the instance view for the new id for the loading pathway diagram.
   * @param id 
   */
  handleDiagramIdChange(id: number) {
    this.instanceView?.loadInstance(id);
  }

}
