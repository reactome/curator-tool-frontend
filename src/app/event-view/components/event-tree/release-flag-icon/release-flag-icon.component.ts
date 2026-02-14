import {Component, Input, OnInit, OnChanges, SimpleChanges} from '@angular/core';

@Component({
  selector: 'release-flag-icon',
  templateUrl: './release-flag-icon.component.html',
  styleUrls: ['./release-flag-icon.component.scss']
})

export class ReleaseFlagComponent implements OnInit, OnChanges{
  width = '15px';
  height = '15px';
  icon1Image = '';
  tooltip = '';
  @Input() doRelease: boolean = false;
  hidden = '';

  ngOnInit() {
    this.getImage();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['doRelease']) {
      this.getImage();
    }
  }

  getImage() {
    if (this.doRelease) {
      this.icon1Image = 'assets/images/Selected.png';
      this.tooltip = 'released. click to unrelease. shift + click to unrelease all under this event';
    } 
    else {
      this.icon1Image = 'assets/images/Unselected.png';
      this.tooltip = 'not released. click to release. shift + click to release all under this event';
    }
  }
}
