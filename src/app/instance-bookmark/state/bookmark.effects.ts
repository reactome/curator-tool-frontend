import { DataService } from "src/app/core/services/data.service";
import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {BookmarkActions} from "./bookmark.actions";
import {catchError, EMPTY, map, mergeMap} from "rxjs";

@Injectable()
export class BookmarkEffects {

  // getInstance$ = createEffect(() => {
  //   return this.actions$.pipe(
  //     ofType(BookmarkActions.get_bookmark),
  //     mergeMap(({dbId}) =>
  //       this.dataService.fetchInstance(dbId).pipe(
  //         mergeMap(inst => [BookmarkActions.add_bookmark(inst)]),
  //         catchError((error) => EMPTY) // TODO: To be updated
  //       )
  //     ),
  //     catchError(() => EMPTY)
  //   )});

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
