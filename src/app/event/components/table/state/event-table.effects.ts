import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {EventTableActions} from "./event-table.actions";
import {catchError, EMPTY, map, mergeMap, of, tap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";

@Injectable()
export class EventTableEffects {

  getEvent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(EventTableActions.get),
      // check if className has been fetched, otherwise perform call
      mergeMap(({className}) =>
          this.dataService.fetchEvent(className).pipe(
            catchError(() => EMPTY),
            map(event => EventTableActions.set(event),
            )))
    ), {dispatch: true}
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {
  }
}
