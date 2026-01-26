import {Component, OnInit, ViewChild} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";

@Component({
  selector: 'app-main-schema-view',
  templateUrl: './main-schema-view.component.html',
  styleUrls: ['./main-schema-view.component.scss'],
})
export class MainSchemaViewComponent implements OnInit{
  sideWidth = 400;
  schemaPanelOpen= false;
  resizing: boolean = false;
  showChanged = false; // Default state
  status = {closed: true, opened: false, dragging: false};

  ngOnInit(): void {
    // Restore the state from localStorage
    const savedState = sessionStorage.getItem('statusPaneInSchemaView');
    this.showChanged = savedState === 'shown' ? true : false;
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

  showUpdatedInstances(show: boolean): void {
    this.showChanged = ! this.showChanged;
    // Save the state to localStorage
    sessionStorage.setItem('statusPaneInSchemaView', this.showChanged ? 'shown' : 'hidden');
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
}
