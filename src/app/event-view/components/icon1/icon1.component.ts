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
  @Input() className: string = '';
  hidden = '';

  ngOnInit() {
    this.getImage();
  }

  getImage() {
    if (this.className == "DatabaseObject") {
      this.icon1Image = 'assets/images/Selected.png';
    } else if (this.className == "AbstractModifiedResidue") {
      this.hidden = 'hidden';
    } else {
      this.icon1Image = 'assets/images/Unselected.png';
    }
  }
}
