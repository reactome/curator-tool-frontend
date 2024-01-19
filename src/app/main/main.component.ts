import {Component} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent {
  sideWidth = 400;
  resizing: boolean = false;
  showInstanceList: number = 0;
  sideWidthBookMark = 10;
  status = {closed: true, opened: false, dragging: false};

  constructor() {
  }

  resizeLeft(e: CdkDragMove) {
    this.sideWidth = e.pointerPosition.x
  }

  expandPanel() {
    this.sideWidthBookMark = this.sideWidthBookMark + 240;
    console.log(this.sideWidthBookMark);
  }

  closePanel() {
    this.sideWidthBookMark = 10;
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
