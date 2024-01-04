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

  constructor() {
  }

  resize(e: CdkDragMove) {
    this.sideWidth = e.pointerPosition.x
  }

  showUpdatedInstances(showList: boolean) {
    console.log(showList);
    if(showList) {this.showInstanceList = 1}
    else {this.showInstanceList = 0;}
  }
}
