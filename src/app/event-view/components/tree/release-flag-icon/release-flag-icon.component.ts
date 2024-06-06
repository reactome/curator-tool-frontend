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
