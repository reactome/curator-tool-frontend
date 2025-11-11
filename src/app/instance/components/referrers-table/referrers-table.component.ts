import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Instance, Referrer} from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import {ViewOnlyService} from "../../../core/services/view-only.service";
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from 'src/app/schema-view/list-instances/components/list-instances-view/instance-list-table/instance-list-table.component';

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-referrers-table',
  templateUrl: './referrers-table.component.html',
  styleUrls: ['./referrers-table.component.scss']
})
export class ReferrersTableComponent {
  selected: string = '';
  instanceList: Referrer[] = [];
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH];
  showProgressSpinner: boolean = false;
  totalCount: number = 0;
  @Input() instance: Instance | undefined;
  @Output() numberOfRefs = new EventEmitter<number>();

  // Using constructor to correctly initialize values
  constructor(private dataService: DataService, private instanceService: InstanceUtilities) {
    setTimeout(() => {
      // Wrap them together to avoid NG0100 error
      this.showProgressSpinner = true;
      this.dataService.getReferrers(this.instance!.dbId).subscribe(referrers => {
        referrers.forEach(ref => {this.totalCount += ref.referrers.length})
        this.instanceList = referrers.sort((a, b) => a.attributeName.localeCompare(b.attributeName));
        this.showProgressSpinner = false;
        this.numberOfRefs.emit(this.totalCount);
      })
      // TODO: Remove instances from referral list that are marked to be deleted.
    });
  }

  handleAction(actionEvent: { instance: Instance; action: string }) {
    switch(actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}`, '_blank');
      }
    }
  }

  showFirstTable(index: number): boolean {
    if(index === 0) return false;
    else return true;
  }

  openTable(attributeName: string) {
      let isHidden = document.getElementById(attributeName)!.hidden;
      document.getElementById(attributeName)!.hidden = !isHidden;
  }

  navigateUrl(instance: Instance) {
    return window.open("/schema_view/instance/" + instance.dbId.toString())
  }
}
