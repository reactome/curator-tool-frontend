import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { filter, map, take, tap, withLatestFrom } from "rxjs/operators";
import { BookmarkActions } from './bookmark.actions';
import { Instance } from "src/app/core/models/reactome-instance.model";
import { bookmarkedInstances } from "./bookmark.selectors";
import { DeleteInstanceActions } from "src/app/instance/state/instance.actions";

// We will use localstorage to synchronize states among opened tabs or windows.
// the broadcast API is great to synchronize changes after windows are opened.
// However, it is quite difficult to determine a time delay to ask the states from other
// opened tabs or load the data from the server directly. It may overcome multiple tabs
// to send the same objects by using the elected leader patten. But the time delay is still
// quite difficult to control. 
@Injectable()
export class BookmarkEffects {

  constructor(
    private store: Store,
    private actions$: Actions
  ) { 
    window.addEventListener('storage', (event) => {
      if (event.key === BookmarkActions.add_bookmark.type) {
        const bookmark = this.parseBookmark(event.newValue);
        if (bookmark) this.store.dispatch(BookmarkActions.ls_add_bookmark(bookmark));
      }
      else if (event.key === BookmarkActions.remove_bookmark.type) {
        const bookmark = this.parseBookmark(event.newValue);
        if (bookmark) this.store.dispatch(BookmarkActions.ls_remove_bookmark(bookmark));
      }
    })
  }

  private parseBookmark(raw: string | null): Instance | undefined {
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || parsed.dbId === undefined || parsed.dbId === null) {
      return undefined;
    }
    return parsed as Instance;
  }

  bookmarkChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(BookmarkActions.add_bookmark, BookmarkActions.remove_bookmark),
        tap((action) => {
          // The browser tab (window) that setItem should not receive this event.
          localStorage.setItem(action.type, JSON.stringify(action.valueOf()));
          // Update the list of bookmarks for new tabs or windows
          this.store.select(bookmarkedInstances()).pipe(take(1)).subscribe(bookmarks => {
            localStorage.setItem(BookmarkActions.set_bookmarks.type, JSON.stringify(bookmarks));
          });
        })
      ),
    { dispatch: false }
  );

  // A deleted instance should never stay in the bookmark list: it cannot be viewed
  // or dragged into an attribute slot any longer.
  // register_deleted_instance covers database instances marked for deletion, while
  // commit_deleted_instance covers both committed deletions and local-only new
  // instances (dbId < 0) that are dropped without ever reaching the database.
  removeBookmarkOnDelete$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DeleteInstanceActions.register_deleted_instance,
          DeleteInstanceActions.commit_deleted_instance),
        withLatestFrom(this.store.select(bookmarkedInstances())),
        map(([action, bookmarks]) => (bookmarks || []).find(bookmark => bookmark && bookmark.dbId === action.dbId)),
        // Don't touch the state (or the local storage sync) if it is not bookmarked
        filter((bookmark): bookmark is Instance => bookmark !== undefined),
        map(bookmark => BookmarkActions.remove_bookmark(bookmark))
      )
  );
}
