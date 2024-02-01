import { DataService } from "src/app/core/services/data.service";
import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {BookmarkActions} from "./bookmark.actions";
import {catchError, combineLatestWith, concatMap, EMPTY, map, mergeMap, of, switchMap} from "rxjs";
import {CookieService} from "ngx-cookie-service";
import {bookmarkedInstances} from "./bookmark.selectors";
import {Store} from "@ngrx/store";
import {combineLatest} from "rxjs/internal/operators/combineLatest";

@Injectable()
export class BookmarkEffects {

  // loadBookmarks$ = createEffect(() => {
  //   return this.actions$.pipe(
  //     ofType(BookmarkActions.load_bookmarks),
  //     switchMap(() =>{
  //
  //         let bookmarks = JSON.parse(this.cookieService.get('bookmarks'));
  //         console.log(bookmarks)
  //         return of(BookmarkActions.set_bookmarks({instances:bookmarks}))
  //     }
  //     ),
  //     catchError(() => EMPTY)
  //   )});
  //
  // addBookmark$ = createEffect(() => this.actions$.pipe(
  //   ofType(BookmarkActions.add_bookmark, BookmarkActions.remove_bookmark),
  //   concatMap((instance) =>
  //     // of(BookmarkActions.save_bookmarks())
  //     this.bookmarks$.pipe(
  //       switchMap( instances => {
  //         this.cookieService.set('bookmarks', JSON.stringify(instances));
  //         // return of(BookmarkActions.load_bookmarks());
  //       })
  //     )
  //   ),
  // ))

  bookmarks$ = this.store.select(bookmarkedInstances());

  constructor(
    private store: Store,
    private actions$: Actions,
    private cookieService: CookieService
  ) {}
}
