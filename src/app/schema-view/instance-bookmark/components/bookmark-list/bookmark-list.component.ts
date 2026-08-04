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
    // Note: An instance that is marked as deleted should not be used and therefore is
    // dropped from the bookmark list. This is different from the instance view: an
    // instance is deleted but not commited can still be used in the attribute list!!!
    // TODO: This behavior is quite confusing. Need to think more!
    // The removal itself is done by BookmarkEffects.removeBookmarkOnDelete$ so that it
    // also happens when this component is not rendered.
    let subscription = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      // This will change the dbId and display name
      const removed = this.bookmarks.filter(inst => inst.dbId === oldDbId);
      if (removed.length > 0) {
        this.store.dispatch(BookmarkActions.remove_bookmark(removed[0]));
        // Add the new instance
        this.dataService.fetchInstance(newDbId).subscribe(inst => {
          this.store.dispatch(BookmarkActions.add_bookmark(this.instUtils.makeShell(inst)));
        });
      }
    });
    this.subscriptions.push(subscription);
  }

  ngOnInit() {
    let subscription = this.instUtils.refreshViewDbId$.subscribe(dbId => {
      let dbIdsFromBookmarkStore: number[] = [];
      this.store.select(bookmarkedInstances()).pipe(take(1)).subscribe((instances: Instance[] | undefined) => {
        if (instances !== undefined) {
          dbIdsFromBookmarkStore = instances.map(inst => inst.dbId);
        }
      })

      if (dbIdsFromBookmarkStore.includes(dbId) && !this.instUtils.isPermanentlyRemovedNewInstance(dbId)) {
        this.dataService.fetchInstance(dbId).subscribe(instance => {
          this.store.dispatch(BookmarkActions.add_bookmark(this.instUtils.makeShell(instance)));
        }
        )
      }
    });
    this.subscriptions.push(subscription);

    // Need to call the store when the instanceView has not changed. 
    subscription = this.store.select(bookmarkedInstances()).subscribe((instances: Instance[] | undefined) => {
      if (instances !== undefined) {
        // Defensive guard: ignore malformed bookmark entries from stale local state and
        // any local-only new instance (dbId < 0) that has been deleted, which may be
        // restored from persisted bookmarks saved before the deletion.
        const stale = instances.filter(inst => inst && this.instUtils.isPermanentlyRemovedNewInstance(inst.dbId));
        this.bookmarks = instances.filter(inst => inst && inst.dbId !== undefined && inst.dbId !== null
          && !this.instUtils.isPermanentlyRemovedNewInstance(inst.dbId));
        // Drop them from the state too so they are not persisted again
        stale.forEach(inst => this.store.dispatch(BookmarkActions.remove_bookmark(inst)));
      }
    });
    this.subscriptions.push(subscription);
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
    if (!instance || instance.dbId === undefined || instance.dbId === null) {
      return;
    }
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    let newUrl = currentPathRoot[0] + "/instance/" + instance.dbId.toString();
    this.router.navigate([newUrl], { queryParamsHandling: 'preserve' });
  }
}
