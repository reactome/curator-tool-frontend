import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import {EMPTY, catchError, mergeMap, tap} from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { InstanceActions } from "./instance.actions";

@Injectable()
export class DatabaseObjectEffects {

  getInstance$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(InstanceActions.get_instance),
      mergeMap(({dbId}) =>
        this.dataService.fetchInstance(dbId).pipe(
          mergeMap(inst => [InstanceActions.view_instance(inst)]),
          catchError((error) => EMPTY) // TODO: To be updated
        )
      ),
      catchError(() => EMPTY)
  )});

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
