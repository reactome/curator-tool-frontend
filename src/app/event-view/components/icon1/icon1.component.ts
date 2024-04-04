import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'icon1-image',
  templateUrl: './icon1.component.html',
  styleUrls: ['./icon1.component.scss']
})

export class Icon1Component implements OnInit{
  width = '15px';
  height = '15px';
  icon1Image = '';
  @Input() doRelease: boolean = false;
  hidden = '';

  ngOnInit() {
    this.getImage();
  }

  getImage() {
    if (this.doRelease) {
      this.icon1Image = 'assets/images/Selected.png';
    } else {
      this.icon1Image = 'assets/images/Unselected.png';
    }
  }
}
