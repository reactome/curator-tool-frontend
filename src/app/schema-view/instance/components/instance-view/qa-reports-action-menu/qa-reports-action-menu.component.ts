import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export interface User {
  name: string;
}

/**
 * This is just a dummy action list. Clicking any action sends out the clicked menu item
 * for other components to handle.
 * TODO: See if this menu can be refactored for generic use.
 */
@Component({
  selector: 'qa-reports-action-menu',
  templateUrl: './qa-reports-action-menu.component.html',
  styleUrls: ['./qa-reports-action-menu.component.scss'],
})
export class QAReportsActionMenuComponent {
  @Output() actionItem = new EventEmitter<string>();
  @Input() instance: Instance | undefined;
  hidePanel: boolean = false;
  qaIssueKeys: string[] = [];

  constructor() {
  }

  ngOnChanges() {
    if (this.instance !== undefined && this.instance.qaIssues !== undefined) {
      this.qaIssueKeys = Array.from(this.instance.qaIssues.keys());
    }
  }

  onClick(editAction: string) {
    this.actionItem.emit(editAction);
    this.hidePanel = true;
  }

}
