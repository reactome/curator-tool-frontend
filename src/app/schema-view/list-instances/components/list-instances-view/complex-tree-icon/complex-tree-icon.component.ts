import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'complex-tree-icon',
  templateUrl: './complex-tree-icon.component.html',
  styleUrls: ['./complex-tree-icon.component.scss']
})

export class ComplexTreeIconComponent implements OnInit{
  width = '15px';
  height = '15px';
  iconImage = '';
  @Input() schemaClass: string = "";

  ngOnInit() {
    this.getImage();
  }

  getImage() {
    if (this.schemaClass !== undefined) {
      if (this.schemaClass === "EntityWithAccessionedSequence") {
         this.iconImage = 'assets/images/Protein.gif';
      } else if (this.schemaClass === "SimpleEntity") {
         this.iconImage = 'assets/images/Chemical.gif';
      } else if (this.schemaClass === "Complex") {
         this.iconImage = 'assets/images/Complex.gif';
      } else {
         this.iconImage = 'assets/images/Entity.gif';
      }
    } else {
        this.iconImage = 'assets/images/Entity.gif';
    }
  }
}
