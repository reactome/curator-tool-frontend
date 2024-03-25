import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'icon2-image',
  templateUrl: './icon2.component.html',
  styleUrls: ['./icon2.component.scss']
})

export class Icon2Component implements OnInit{
  width = '15px';
  height = '15px';
  icon2Image = '';
  @Input() className: string = '';
  hidden = '';

  ngOnInit() {
    this.getImage();
  }

  getImage() {
    if (this.className == "DatabaseObject") {
      this.icon2Image = 'assets/images/Reaction.gif';
    } else if (this.className == "AbstractModifiedResidue") {
      this.icon2Image = 'assets/images/BlackboxEvent.gif';
    } else if (this.className == "GeneticallyModifiedResidue") {
      this.hidden = 'hidden';
    } else {
      this.icon2Image = 'assets/images/Deploymerization.gif';
    }
  }
}
