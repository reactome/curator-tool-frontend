import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import { updateSharedState } from './app.actions';
import {BroadcastService} from "../core/services/broadcast.service";

@Injectable()
export class AppEffects {
  constructor(
    private actions$: Actions,
    private broadcastService: BroadcastService
  ) {}

  broadcastStateChange$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(updateSharedState),
        tap((action) => {
          this.broadcastService.broadcast(action.payload);
        })
      ),
    { dispatch: false }
  );
}
