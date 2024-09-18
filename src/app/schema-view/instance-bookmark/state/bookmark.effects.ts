import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { tap } from "rxjs/operators";
import { BookmarkActions } from './bookmark.actions';
import { Instance } from "src/app/core/models/reactome-instance.model";

@Injectable()
export class BookmarkEffects {

  constructor(
    private store: Store,
    private actions$: Actions
  ) { 
    window.addEventListener('storage', (event) => {
      if (event.key === BookmarkActions.add_bookmark.type) {
        const bookmark = JSON.parse(event.newValue || '{}');
        this.store.dispatch(BookmarkActions.add_bookmark(bookmark as Instance));
      }
      else if (event.key === BookmarkActions.remove_bookmark.type) {
        const bookmark = JSON.parse(event.newValue || '{}');
        this.store.dispatch(BookmarkActions.remove_bookmark(bookmark as Instance));
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
        })
      ),
    { dispatch: false }
  );
}
