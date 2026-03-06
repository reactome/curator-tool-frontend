import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Instance, Referrer } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from 'src/app/schema-view/list-instances/components/list-instances-view/instance-list-table/instance-list-table.component';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';

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
  instance2ReviewStatusChange: Array<Instance> = new Array<Instance>();
  @Input() deletion: boolean = false; // Whether the referrers are shown for a deletion action. If true, the structural change check will be based on the change of review status. Otherwise, it will be based on the change of display name. This is because for deletion, the display name will not be changed and the review status change is more likely to be caused by structural change. For other editing actions, the display name change is more likely to be caused by structural change.
  @Input() instance: Instance | undefined;
  @Output() numberOfRefs = new EventEmitter<number>();

  // Using constructor to correctly initialize values
  constructor(private dataService: DataService, private instanceService: InstanceUtilities,
    private reviewStatusCheck: ReviewStatusCheck,
  ) {
    setTimeout(() => {
      // Wrap them together to avoid NG0100 error
      this.showProgressSpinner = true;
      this.dataService.getReferrers(this.instance!.dbId).subscribe(referrers => {
        referrers.forEach(ref => {
          this.totalCount += ref.referrers.length
          for (let inst of ref.referrers) {
            if (this.reviewStatusCheck.checkChangeReviewStatus(inst, ref.attributeName)) {
              this.instance2ReviewStatusChange.push(inst);
            };
          }
        })
        this.instanceList = referrers.sort((a, b) => a.attributeName.localeCompare(b.attributeName));
        this.showProgressSpinner = false;
        this.numberOfRefs.emit(this.totalCount);
      })
      // TODO: Remove instances from referral list that are marked to be deleted.
    });
  }

  handleAction(actionEvent: { instance: Instance; action: string }) {
    switch (actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}`, '_blank');
      }
    }
  }

  showFirstTable(index: number): boolean {
    if (index === 0) return false;
    else return true;
  }

  openTable(attributeName: string) {
    let isHidden = document.getElementById(attributeName)!.hidden;
    document.getElementById(attributeName)!.hidden = !isHidden;
  }

  navigateUrl(instance: Instance) {
    return window.open("/schema_view/instance/" + instance.dbId.toString())
  }

  // For each referrer, check if changing the attribute would cause review status change
  // This structural change will apply to all instances contained by the attribute
  isStructuralChange(inst: Instance): boolean {
    if (!this.deletion) {
      return false; // For non-deletion action do not warn about structural change 
    }
    return this.instance2ReviewStatusChange.some(i => i.dbId === inst.dbId);

  }
}
