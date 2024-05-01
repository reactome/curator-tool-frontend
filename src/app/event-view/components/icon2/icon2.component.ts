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
    if (this.className == "Reaction") {
      this.icon2Image = 'assets/images/Reaction.gif';
    } else if (this.className == "Pathway" || this.className == "TopLevelPathway") {
      this.icon2Image = 'assets/images/Pathway.gif';
    } else if (this.className == "BlackBoxEvent") {
      this.icon2Image = 'assets/images/BlackboxEvent.gif';
    } else if (this.className == "Polymerisation") {
      this.icon2Image = 'assets/images/Polymerization.gif';
    } else if (this.className == "Depolymerisation") {
      this.icon2Image = 'assets/images/Depolymerisation.gif';
    } else if (this.className == "FailedReaction") {
      this.icon2Image = 'assets/images/FailedReaction.gif';
    } else {
      this.hidden = 'hidden';
    }

  }
}
