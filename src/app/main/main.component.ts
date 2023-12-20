import {Component} from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent {
  showResize: boolean = false;
  sideWidth = 400;
  resizing: boolean = false;
  showInstanceList: number = 0;

  constructor() {
  }

  resize(e: CdkDragMove) {
    this.sideWidth = e.pointerPosition.x
  }

  changeShowResize() {
    this.showResize = !this.showResize
  }

  showUpdatedInstances(index: number) {
    console.log(index);
    this.showInstanceList = index;
  }
}
