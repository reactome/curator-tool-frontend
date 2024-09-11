import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {Store} from "@ngrx/store";
import {BroadcastService} from "../../../core/services/broadcast.service";
import {tap} from "rxjs/operators";
import {BookmarkActions} from './bookmark.actions';

@Injectable()
export class BookmarkEffects {

  constructor(
    private store: Store,
    private actions$: Actions,
    private broadcastService: BroadcastService
  ) {}


  broadcastStateChange$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(BookmarkActions.add_bookmark, BookmarkActions.remove_bookmark),
        tap((action) => {
          this.broadcastService.broadcast(action);
        })
      ),
    { dispatch: false }
  );
}
