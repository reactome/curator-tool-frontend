import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'release-flag-icon',
  templateUrl: './release-flag-icon.component.html',
  styleUrls: ['./release-flag-icon.component.scss']
})

export class ReleaseFlagComponent implements OnInit{
  width = '15px';
  height = '15px';
  icon1Image = '';
  tooltip = '';
  @Input() doRelease: boolean = false;
  hidden = '';

  ngOnInit() {
    this.getImage();
  }

  getImage() {
    if (this.doRelease) {
      this.icon1Image = 'assets/images/Selected.png';
      this.tooltip = 'released';
    } 
    else {
      this.icon1Image = 'assets/images/Unselected.png';
      this.tooltip = 'not released';
    }
  }
}
