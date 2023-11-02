import { Component } from '@angular/core';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent {
  showResize: boolean = false;
  sideWidth = 400;
  resizing: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) {
  }

  resize(e: CdkDragMove) {
    this.sideWidth = e.pointerPosition.x
  }

  changeShowResize() {
    this.showResize = !this.showResize
  }
}
