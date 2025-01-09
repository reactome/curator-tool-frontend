import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { Instance } from "../../../../core/models/reactome-instance.model";
import { DragDropService } from "../../drag-drop.service";
import { bookmarkedInstances } from "../../state/bookmark.selectors";
import { Store } from "@ngrx/store";
import { BookmarkActions } from "../../state/bookmark.actions";
import { Router, ActivatedRoute } from "@angular/router";
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DataService } from 'src/app/core/services/data.service';
import { Subscription, take } from 'rxjs';

@Component({
  selector: 'app-bookmark-list',
  templateUrl: './bookmark-list.component.html',
  styleUrls: ['./bookmark-list.component.scss'],
})
export class BookmarkListComponent implements OnInit {
  bookmarks: Instance[] = [];
  dragging = { show: true, hide: false };
  cachedBookmarks: any[] = [];

  private subscriptions: Subscription[] = [];

  constructor(public dragDropService: DragDropService,
    public store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private instUtils: InstanceUtilities,
    private dataService: DataService) {
    // An instance that is marked as deleted should not be used
    // This is different from the instance view: an instance is deleted but
    // not commited can still be used in the attribute list!!!
    // TODO: This behavior is quite confusing. Need to think more!
    let subscription = (this.instUtils.markDeletionDbId$.subscribe(dbId => {
      const found = this.bookmarks.filter(inst => inst.dbId === dbId);
      if (found.length > 0)
        this.store.dispatch(BookmarkActions.remove_bookmark(found[0])); // There should be only one
    }));
    this.subscriptions.push(subscription);
    this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      // This will change the dbId and display name
      const removed = this.bookmarks.filter(inst => inst.dbId === oldDbId);
      if (removed.length > 0)
        this.store.dispatch(BookmarkActions.remove_bookmark(removed[0]));
      // Add the new instance
      this.dataService.fetchInstance(newDbId).subscribe(inst => {
        this.store.dispatch(BookmarkActions.add_bookmark(this.instUtils.makeShell(inst)));
      });
    });
  }

  ngOnInit() {
    let subscription = this.instUtils.refreshViewDbId$.subscribe(dbId => {
      let dbIdsFromBookmarkStore: number[] = [];
      this.store.select(bookmarkedInstances()).pipe(take(1)).subscribe((instances: Instance[] | undefined) => {
        if (instances !== undefined) {
          dbIdsFromBookmarkStore = instances.map(inst => inst.dbId);
        }
      })

      if (dbIdsFromBookmarkStore.includes(dbId)) {
        this.dataService.fetchInstance(dbId).subscribe(instance => {
          this.store.dispatch(BookmarkActions.add_bookmark(instance));
        }
        )
      }
    });
    this.subscriptions.push(subscription);

    // Need to call the store when the instanceView has not changed. 
    this.store.select(bookmarkedInstances()).subscribe((instances: Instance[] | undefined) => {
      if (instances !== undefined) {
        this.bookmarks = instances;
      }
    })
  }

  ngOnDestroy(): void {
    for (let subscription of this.subscriptions)
      subscription.unsubscribe();
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
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    let newUrl = currentPathRoot[0] + "/instance/" + instance.dbId.toString();
    this.router.navigate([newUrl], { queryParamsHandling: 'preserve' });
  }
}
