import {Component, OnInit} from '@angular/core';
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {Instance} from "../../../../core/models/reactome-instance.model";
import {DragDropService} from "../../../drag-drop.service";
import {DataService} from "../../../../core/services/data.service";
import {bookmarkedInstances} from "../../../state/bookmark.selectors";
import {Store} from "@ngrx/store";
import {BookmarkActions} from "../../../state/bookmark.actions";
import {Router} from "@angular/router";

@Component({
  selector: 'app-bookmark-list',
  templateUrl: './bookmark-list.component.html',
  styleUrls: ['./bookmark-list.component.scss'],
})
export class BookmarkListComponent implements OnInit {
  bookmarks: Instance[] = [];
  dragging = {show: true, hide: false};
  cachedBookmarks: any[] = [];

  constructor(public dragDropService: DragDropService,
              public dataService: DataService,
              public store: Store,
              private router: Router) {
  }

  ngOnInit() {
    this.store.select(bookmarkedInstances()).subscribe((instances: Instance[] | undefined) => {
      if (instances !== undefined) {
        this.bookmarks = instances;
      }
    })
  }

  drop(event: CdkDragDrop<Instance[]>) {
    moveItemInArray(this.bookmarks, event.previousIndex, event.currentIndex);
    let attributeName = event.container.id;
    console.log(attributeName)
  }

  onRemove(instance: Instance) {
    this.store.dispatch(BookmarkActions.remove_bookmark(instance));
  }

  navigate(instance: Instance) {
    this.router.navigate(["/instance_view/" + instance.dbId.toString()], {queryParamsHandling: 'preserve'});
  }
}
