import {Component, ViewChild} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-main-schema-view',
  templateUrl: './main-schema-view.component.html',
  styleUrls: ['./main-schema-view.component.scss'],
})
export class MainSchemaViewComponent {
  sideWidth = 400;
  schemaPanelOpen= false;
  resizing: boolean = false;
  showInstanceList: number = 0;
  status = {closed: true, opened: false, dragging: false};

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
}
