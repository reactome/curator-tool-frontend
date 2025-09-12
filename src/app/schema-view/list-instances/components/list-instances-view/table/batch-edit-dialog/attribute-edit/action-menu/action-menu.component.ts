import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EDIT_ACTION } from 'src/app/instance/components/instance-view/instance-table/instance-table.model';

export interface User {
  name: string;
}

/**
 * This is just a dummy action list. Clicking any action sends out the clicked menu item
 * for other components to handle.
 * TODO: See if this menu can be refactored for generic use.
 */
@Component({
  selector: 'app-edit-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss'],
})
export class EditMenuComponent {
  @Input() isSingledValued: boolean = false;
  @Input() isInstanceType: boolean = false;

  @Output() actionItem = new EventEmitter<EDIT_ACTION>();
  EDIT_ACTION = EDIT_ACTION;
  hidePanel: boolean = false;

  constructor() {
  }

  onClick(editAction: EDIT_ACTION) {
    this.actionItem.emit(editAction);
    this.hidePanel = true;
  }

}
