import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { EMPTY, catchError, exhaustMap, merge, mergeMap, of, tap } from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { InstanceActions } from "./instance.actions";
import { Instance } from "src/app/core/models/reactome-instance.model";

@Injectable()
export class DatabaseObjectEffects {
  private fetchedDbObjects: Set<string> = new Set();

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
