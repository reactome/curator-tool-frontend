import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {Store} from "@ngrx/store";
import {BroadcastService} from "../../../core/services/broadcast.service";
import {tap} from "rxjs/operators";
import {BookmarkActions} from './bookmark.actions';
import { Instance } from "src/app/core/models/reactome-instance.model";

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

  onMessage$ = createEffect(() =>
    this.broadcastService.onMessage$.pipe(
      ofType(BookmarkActions.add_bookmark, BookmarkActions.remove_bookmark),
      tap((action) => {
        console.debug('In bookmark effects: ' + action);
        // Don't try to create a new action by replacing the type as described in the original
        // web page: https://github.com/stefanoslig/broadcast-channel-ngrx-demo. Somehow it 
        // causes an infinity loop. Not sure why.
        if (BookmarkActions.add_bookmark.type === action.type) {
          this.store.dispatch(BookmarkActions.bc_add_bookmark(action.valueOf() as Instance));
        }
        else {
          this.store.dispatch(BookmarkActions.bc_remove_bookmark(action.valueOf() as Instance));
        }
      })
    ),
  { dispatch: false }
  );
}
