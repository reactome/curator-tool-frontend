import { DataService } from "src/app/core/services/data.service";
import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {BookmarkActions} from "./bookmark.actions";
import {catchError, EMPTY, map, mergeMap} from "rxjs";
import {CookieService} from "ngx-cookie-service";

@Injectable()
export class BookmarkEffects {

  // getBookmarks$ = createEffect(() => {
  //   return this.actions$.pipe(
  //     ofType(BookmarkActions.get_bookmark),
  //     mergeMap(({dbId}) =>
  //       this.cookieService.get('bookmarks').pipe(
  //         mergeMap(inst => [BookmarkActions.add_bookmark(inst)]),
  //         catchError((error) => EMPTY) // TODO: To be updated
  //       )
  //     ),
  //     catchError(() => EMPTY)
  //   )});

  constructor(
    private actions$: Actions,
    private cookieService: CookieService
  ) {}
}
