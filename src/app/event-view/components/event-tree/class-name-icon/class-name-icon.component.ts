import {Component, Input, OnChanges} from '@angular/core';

@Component({
  selector: 'class-name-icon',
  standalone: true,
  templateUrl: './class-name-icon.component.html',
  styleUrls: ['./class-name-icon.component.scss']
})

export class ClassNameIconComponent implements OnChanges {
  width = '15px';
  height = '15px';
  icon2Image = '';
  @Input() className: string = '';
  hidden = '';

  // OnChanges rather than OnInit: in the instance-view attribute table this component is
  // reused (same instance, new [className]) as edits swap which instance a slot points at,
  // not just created fresh once like an event-tree node.
  ngOnChanges() {
    this.getImage();
  }

  getImage() {
    this.hidden = '';
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
