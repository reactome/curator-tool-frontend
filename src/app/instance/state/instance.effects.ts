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

  addModifiedAttribute$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(InstanceActions.add_modified_attribute),
      mergeMap(({dbId, attName}) =>
      this.dataService.addModifiedAttribute(dbId, attName).pipe(
                mergeMap(inst => [InstanceActions.view_instance(inst)]),
            catchError((error) => EMPTY)
      )))
  })

  // addModifiedAttribute$ = createEffect(() => {
  //   return this.actions$.pipe(
  //     ofType(InstanceActions.add_modified_attribute),
  //     tap(({dbId, attName}) =>
  //       this.dataService.addModifiedAttribute(dbId, attName)))
  // },{dispatch: false})

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
