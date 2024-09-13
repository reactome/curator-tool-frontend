import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import { updateSharedState } from './app.actions';
import {BroadcastChannelService} from "../broadcast-channel/broadcast-channel.service";

@Injectable()
export class AppEffects {
  constructor(
    private actions$: Actions,
    private broadcastService: BroadcastChannelService
  ) {}

  broadcastStateChange$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(updateSharedState),
        tap((action) => {
          this.broadcastService.postMessage(action.payload);
        })
      ),
    { dispatch: false }
  );
}
