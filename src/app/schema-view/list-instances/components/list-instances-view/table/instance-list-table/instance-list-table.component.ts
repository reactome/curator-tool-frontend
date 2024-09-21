import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { Store } from "@ngrx/store";
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Instance, NEW_DISPLAY_NAME } from "../../../../../../core/models/reactome-instance.model";
import { BookmarkActions } from "../../../../../instance-bookmark/state/bookmark.actions";

@Component({
  selector: 'app-instance-list-table',
  templateUrl: './instance-list-table.component.html',
  styleUrls: ['./instance-list-table.component.scss'],
})
export class InstanceListTableComponent {
  @Input() dataSource: Instance[] = [];
  @Input() actionButtons: string[] = [];
  @Input() isSelection: boolean = false;
  @Input() showHeader: boolean = true;
  displayedColumns: string[] = ['dbId', 'displayName', 'actionButtons'];
  @Output() selectionEvent = new EventEmitter<Instance>();
  @Output() actionEvent = new EventEmitter<{ instance: Instance, action: string }>();
  selected: number = 0;
  displayName: string | undefined = '';
  @Input() showEmptyMessage: boolean = true;
  @Input() blockRoute: boolean = false;
  readonly newDisplayName: string = NEW_DISPLAY_NAME;

  constructor(private store: Store, 
              private route: ActivatedRoute,
              private instanceUtilities: InstanceUtilities) {
  }

  click(instance: Instance, action: string) {
    let actionButton = {instance, action};
    this.actionEvent.emit(actionButton);
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.selectionEvent.emit(row)
  }

  addBookmark(instance: Instance) {
    this.store.dispatch(BookmarkActions.add_bookmark(instance));
  }

  getInstanceUrl(instance: Instance) {
    if (this.blockRoute)
      return undefined;
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    return "/" + currentPathRoot[0] + "/instance/" + instance.dbId.toString();
  }

  onInstanceLinkClicked(instance: Instance) {
    this.instanceUtilities.setLastClickedDbId(instance.dbId);
  }

  getToolTip(button: string) {
    if (button === 'list_alt')
      return 'show referrers';
    if (button === 'undo')
      return 'reset instance';
    if (button === 'upload')
      return 'commit';
    return button + ' instance';
  }
}
