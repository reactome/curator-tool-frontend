import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-side-navigation',
  templateUrl: './side-navigation.component.html',
  styleUrls: ['./side-navigation.component.scss']
})
export class SideNavigationComponent {
  @Input() showUpdatedList: number = 0;
  @Output() updateTabIndexEvent = new EventEmitter<boolean>();

  constructor() {
  }


  updateTabIndex() {
    let showList = this.showUpdatedList !== 0;
    this.updateTabIndexEvent.emit(showList);
  }
}
