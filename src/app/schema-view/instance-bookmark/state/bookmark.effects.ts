import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { take, tap } from "rxjs/operators";
import { BookmarkActions } from './bookmark.actions';
import { Instance } from "src/app/core/models/reactome-instance.model";
import { bookmarkedInstances } from "./bookmark.selectors";

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
        const bookmark = JSON.parse(event.newValue || '{}');
        this.store.dispatch(BookmarkActions.ls_add_bookmark(bookmark as Instance));
      }
      else if (event.key === BookmarkActions.remove_bookmark.type) {
        const bookmark = JSON.parse(event.newValue || '{}');
        this.store.dispatch(BookmarkActions.ls_remove_bookmark(bookmark as Instance));
      }
    })
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
}
