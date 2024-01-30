import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Instance} from "../../../../../core/models/reactome-instance.model";
import {DataService} from "../../../../../core/services/data.service";
import {InstanceActions} from "../../../../../instance/state/instance.actions";
import {Store} from "@ngrx/store";
import {BookmarkActions} from "../../../../../instance-bookmark/state/bookmark.actions";
import {CookieService} from "ngx-cookie-service";
import {bookmarkedInstances} from "../../../../../instance-bookmark/state/bookmark.selectors";
import {Serializer} from "@angular/compiler";

@Component({
  selector: 'app-instance-list-table',
  templateUrl: './instance-list-table.component.html',
  styleUrls: ['./instance-list-table.component.scss']
})
export class InstanceListTableComponent {
  @Input() dataSource: Instance[] = [];
  @Input() actionButtons: string[] = [];
  @Input() isSelection: boolean = false;
  @Input() showHeader: boolean = true;
  displayedColumns: string[] = ['dbId', 'displayName', 'actionButtons', 'bookmark'];
  @Output() selectionEvent = new EventEmitter<Instance>();
  @Output() actionEvent = new EventEmitter<{instance: Instance, action: string}>();
  selected: number = 0;
  displayName: string | undefined = '';

  constructor(private store: Store, private cookieService: CookieService) {}

  click(instance: Instance, action: string) {
    let actionButton  = {instance, action};
    this.actionEvent.emit(actionButton);
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.selectionEvent.emit(row)
  }

  addBookmark(instance: Instance){
    this.store.dispatch(BookmarkActions.add_bookmark(instance));
    this.store.select(bookmarkedInstances()).subscribe((instances: Instance[] | undefined) => {
      if (instances !== undefined) {
        let cookies = JSON.stringify(instances);
        this.cookieService.set("bookmarks", cookies)
      }
    })
  }

  protected readonly DataService = DataService;
}
