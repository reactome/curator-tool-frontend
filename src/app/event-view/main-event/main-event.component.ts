import {Component, ViewChild, Input, AfterViewInit} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {EventPlotComponent} from "../graphic-display/components/event-plot/event-plot.component";
import {ActivatedRoute} from "@angular/router";
import {delay, map} from "rxjs/operators";
import {DiagramComponent} from "ngx-reactome-diagram";

@Component({
  selector: 'app-main-schema-view-event-view',
  templateUrl: './main-event.component.html',
  styleUrls: ['./main-event.component.scss'],
})
export class MainEventComponent implements AfterViewInit {
  sideWidth = 400;
  schemaPanelOpen = false;
  resizing: boolean = false;
  showInstanceList: number = 0;
  status = {closed: true, opened: false, dragging: false};

  id$ = this.route.params.pipe(
    map(params => params['id'])
  )
  @ViewChild('diagramComponent')
  diagram!: DiagramComponent;

  // Try to control the popup menu
  showMenu: boolean = false;
  menuPositionX: string = "0px";
  menuPositionY: string = "0px";

  constructor(private route: ActivatedRoute) {
  }

  ngAfterViewInit(): void {
    this.id$.pipe(delay(500)).subscribe(id => {
      this.diagram.cy.nodes().grabify().unpanify();
      this.diagram.cy.nodes('.Compartment').panify();
      // Have to add the following to zoom using mouse scroll. 
      this.diagram.cy.zoomingEnabled(true);
      this.diagram.cy.userZoomingEnabled(true);
      this.diagram.cy.panningEnabled(true);
      this.diagram.cy.userPanningEnabled(true);
      // May need to use cxtapstart or end for Safari. Apparently cxttap cannot work with Safari!
      // this.diagram.cy.nodes().on('cxttapstart', (e:any) => {
      //   this.showCyPopup(e);
      // });
      this.diagram.cy.edges().on('cxttapstart', (e:any) => {
        this.showCyPopup(e);
      });
      this.diagram.cy.on('mousedown', (e: any) => {
        this.showMenu = false;
        e.preventDefault();
      });
    })
  }

  private showCyPopup(event: any) { // Use any to avoid any compiling error
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + 5) + "px";
    this.menuPositionY = (event.renderedPosition.y + 5) + "px";
    this.showMenu = true;
    // event.preventDefault();
  }

  onAction(button: any) {
    this.showMenu = false;
  }

  @ViewChild('sidenav') sidenav: MatSidenav | undefined;

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

}
