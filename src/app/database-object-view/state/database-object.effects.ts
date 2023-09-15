import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {catchError, EMPTY, exhaustMap, map, merge, mergeMap, Observable, of, tap, withLatestFrom} from "rxjs";
import {DataService} from "src/app/core/services/data.service";
import {DatabaseObjectActions, InstanceActions} from "./database-object.actions";
import {TypedAction} from "@ngrx/store/src/models";
import {SchemaClassTableActions} from "../../schema-class-table/state/schema-class-table.actions";
import {toClassName} from "../../core/models/schema-class-attribute-data.model";
import {Store} from "@ngrx/store";
import {selectDatabaseObjectData, selectDatabaseObjectState} from "./database-object.selectors";

@Injectable()
export class DatabaseObjectEffects {
  private fetchedDbObjects: Set<string> = new Set();

  getInstance$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(InstanceActions.get_instance),
      mergeMap(({dbId}) => 
        this.dataService.fetchInstance(dbId).pipe(
          mergeMap(inst => [InstanceActions.view_instance(inst)]),
          catchError((error) => EMPTY) // To be updated
        )
      ),
      catchError(() => EMPTY)
  )});

  // getDatabaseObjectData$: Observable<TypedAction<any>> = createEffect(() => {
  //     return this.actions$.pipe(
  //       ofType(DatabaseObjectActions.get),
  //       // withLatestFrom(action =>
  //       //     of(action).pipe(
  //       //       this.store.pipe(select(selectDatabaseObjectData(dbId: {action.dbId})))
  //       //     )),
  //       mergeMap(({dbId}) =>
  //         //this.store.select(selectDatabaseObjectData(dbId)) ?
  //           //EMPTY :
  //         this.dataService.fetchDatabaseObjectData(dbId).pipe(
  //           //catchError(() => EMPTY),
  //           //tap(schemaClassData => this.fetchedDbObjects.add(dbId)),
  //           mergeMap(databaseObject => [
  //             DatabaseObjectActions.set({dbId, databaseObject}),
  //             // Getting the className to perform the correct call for SchemaClass attribute info
  //             SchemaClassTableActions.get({className: toClassName(databaseObject.find(line => line.key === '@JavaClass')?.value)})
  //           ]),
  //           catchError(() => EMPTY)
  //         )));
  //   }, {dispatch: true}
  // );

  constructor(
    private actions$: Actions,
    private dataService: DataService,
    private store: Store
  ) {}
}
