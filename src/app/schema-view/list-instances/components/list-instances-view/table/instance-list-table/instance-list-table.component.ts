import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from "@ngrx/store";
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Instance, NEW_DISPLAY_NAME, SelectedInstancesList } from "../../../../../../core/models/reactome-instance.model";
import { BookmarkActions } from "../../../../../instance-bookmark/state/bookmark.actions";
import { map, take } from 'rxjs';
import { deleteInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';

export interface ActionButton {
  name: string;
  tooltip: string;
}

@Component({
  selector: 'app-instance-list-table',
  templateUrl: './instance-list-table.component.html',
  styleUrls: ['./instance-list-table.component.scss'],
})

export class InstanceListTableComponent {
  @Input() dataSource: Instance[] = [];
  @Input() actionButtons: Array<ActionButton> = [];
  @Input() secondaryActionButtons: Array<ActionButton> = [];
  @Input() isSelection: boolean = false;
  @Input() showHeader: boolean = true;
  displayedColumns: string[] = ['dbId', 'displayName', 'actionButtons'];
  @Output() selectionEvent = new EventEmitter<Instance>();
  @Output() actionEvent = new EventEmitter<{ instance: Instance, action: string }>();
  selected: number = 0;
  displayName: string | undefined = '';
  @Input() showEmptyMessage: boolean = true;
  @Input() blockRoute: boolean = false;
  @Input() showBookmark: boolean = true; // Keep true, removing from the batch edit view.
  @Input() showCheckMark: boolean = true;
  @Input() selectedInstanceListName: string = SelectedInstancesList.mainInstanceList;
  // @Input() instanceURL: string | undefined; 
  @Output() urlClickEvent = new EventEmitter<Instance>();
  @Output() selectionChangeEvent = new EventEmitter<Instance[]>();
  readonly newDisplayName: string = NEW_DISPLAY_NAME;
  routerNavigationUrl: string = ''
  showSecondaryButtons: boolean = false;
  deletedDBIds: number[] = [];
  updatedDBIds: number[] = [];
  checkedMap: Map<number, boolean> = new Map();

  @Input() set selectAll(value: boolean) {
    for (let instance of this.dataSource) {
      this.checkedMap.set(instance.dbId, value);
    }
  }



  constructor(private store: Store,
    private instanceUtilities: InstanceUtilities) {
  }

  ngOnInit() {
    this.store.select(deleteInstances()).pipe(
      take(1),
      map((instances) => {
        this.deletedDBIds = instances.map(inst => inst.dbId);
      })
    ).subscribe();

    this.store.select(updatedInstances()).pipe(
      take(1),
      map((instances) => {
        this.updatedDBIds = instances.map(inst => inst.dbId);
      })
    ).subscribe();

  }


  addCheckBox(instance: Instance) {
    this.instanceUtilities.addSelectedInstance(this.selectedInstanceListName, instance);
  }

  removeCheckBox(instance: Instance) {
    this.instanceUtilities.removeSelectedInstance(this.selectedInstanceListName, instance);

  }

  isChecked(instance: Instance): boolean {
    return this.instanceUtilities.isInstanceSelected(this.selectedInstanceListName, instance);
  }

  click(instance: Instance, action: string) {
    let actionButton = { instance, action };
    this.actionEvent.emit(actionButton);
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId;
    this.selectionEvent.emit(row);
  }

  addBookmark(instance: Instance) {
    this.store.dispatch(BookmarkActions.add_bookmark(instance));
  }

  onInstanceLinkClicked(instance: Instance) {
    //this.getInstanceUrl(instance);
    this.urlClickEvent.emit(instance);
    this.instanceUtilities.setLastClickedDbId(instance.dbId);
  }

  setNavigationUrl(instance: Instance) {
    if (this.updatedDBIds.includes(instance.dbId) && !this.routerNavigationUrl.includes('local_list_instances')) {
      this.routerNavigationUrl = '/schema_view/instance/' + instance.dbId.toString() + '/comparison/' + instance.dbId.toString();
    }
    else {
      this.routerNavigationUrl = '/schema_view/instance/' + instance.dbId.toString();
    }
  }

  isDeleted(row: Instance) {
    this.store.select(deleteInstances()).pipe(
      take(1),
      map((instances) => {
        this.deletedDBIds = instances.map(inst => inst.dbId);
      })
    ).subscribe();
    return this.deletedDBIds.includes(row.dbId);
  }

  isUpdated(row: Instance) {
    this.store.select(updatedInstances()).pipe(
      take(1),
      map((instances) => {
        this.updatedDBIds = instances.map(inst => inst.dbId);
      })
    ).subscribe();
    return this.updatedDBIds.includes(row.dbId);

  }
}
