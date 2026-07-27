import {Component, OnInit, ViewChild} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {MatSidenav} from "@angular/material/sidenav";
import {NavigationEnd, Router} from "@angular/router";
import {filter, map, startWith} from "rxjs";

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

  /**
   * The bookmark panel is anchored below whatever header the active child route renders.
   * The instance view shows a bread crumb plus a title bar; the list view shows a title bar
   * plus a search field, which is taller. See the .list-view rule in the scss.
   */
  bookmarkLayout$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(event => (event as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
    map(url => url.includes('list_instances') ? 'list-view' : 'instance-view')
  );

  constructor(private router: Router) {
  }

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
