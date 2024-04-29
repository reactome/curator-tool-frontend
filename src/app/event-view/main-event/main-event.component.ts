import {Component, ViewChild, Input} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {ActivatedRoute, Router} from "@angular/router";
import {EventPlotComponent} from "../graphic-display/components/event-plot/event-plot.component";

@Component({
  selector: 'app-main-schema-view-event-view',
  templateUrl: './main-event.component.html',
  styleUrls: ['./main-event.component.scss'],
})
export class MainEventComponent {
  sideWidth = 400;
  schemaPanelOpen= false;
  resizing: boolean = false;
  showInstanceList: number = 0;
  status = {closed: true, opened: false, dragging: false};
  public dbIdAndClassName: string = "";
  public dbIdAndClassNameFromPlot: string = "";
  public dbIdFromURL: string = "";

  constructor(private route: ActivatedRoute) {
      let url = window.location.href.split("/");
      console.log(url)
      if (url.includes("home")){this.closeSidenav(); this.sideWidth=0}
      else{this.openSidenav()}
      this.dbIdFromURL = url.slice(-1)[0];
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
    if(showList) {this.showInstanceList = 1}
    else {this.showInstanceList = 0;}
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

  generatePlotToEventPlot(dbIdAndClassName: string) {
    this.dbIdAndClassName = dbIdAndClassName;
  }

  updateEventTreeToSideNavigation(dbIdAndClassNameFromPlot: string) {
    this.dbIdAndClassNameFromPlot = dbIdAndClassNameFromPlot;
    // Note that the below has an effect of the new plot being generated (as this.dbIdAndClassName is an input to
    // event-plot.component), but we trigger plot generation from here rather than within event-plot.component
    // so that we can override this.dbIdAndClassName with the new event selection in the plot (if we hadn't, the next time
    // the user selects in the event tree the previously selected event, ngOnChanges() in event-plot.component won't kick in
    // and no plot will be generated).
    let selectedDbIdAndClassName = dbIdAndClassNameFromPlot.split(",")[0];
    this.dbIdAndClassName = selectedDbIdAndClassName;
  }
}
