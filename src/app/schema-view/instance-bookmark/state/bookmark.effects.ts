import {Injectable} from "@angular/core";
import {Actions} from "@ngrx/effects";
import {Store} from "@ngrx/store";

@Injectable()
export class BookmarkEffects {

  constructor(
    private store: Store,
    private actions$: Actions,
  ) {
  }
}
