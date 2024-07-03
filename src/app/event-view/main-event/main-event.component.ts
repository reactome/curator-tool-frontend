import {Component, ViewChild, Input, AfterViewInit} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {EventPlotComponent} from "../graphic-display/components/event-plot/event-plot.component";
import {ActivatedRoute} from "@angular/router";
import {delay, map} from "rxjs/operators";
import {DiagramComponent} from "ngx-reactome-diagram";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PathwayDiagramComponent } from '../components/pathway-diagram/pathway-diagram.component';

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

  constructor() {
  }

  // ngAfterViewInit(): void {
  //   this.id$.pipe(delay(500)).subscribe(id => {
  //     this.diagram.cy.nodes().grabify().unpanify();
  //     this.diagram.cy.nodes('.Compartment').ungrabify().panify();
  //     this.diagram.cy.nodes('.Legend').ungrabify().panify();
  //     console.log('diagram', this.diagram.legend.$id('#legend-boundary').width())
  //     this.diagram.legend.data().opened;
  //     this.diagram.legend.width().toFixed(360);
  //   })
  // }


  @ViewChild('sidenav') sidenav: MatSidenav | undefined;
  @ViewChild('diagramView') diagramView: PathwayDiagramComponent | undefined;

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

}
