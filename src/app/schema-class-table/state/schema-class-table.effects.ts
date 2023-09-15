import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {SchemaClassTableActions} from "./schema-class-table.actions";
import {catchError, EMPTY, map, mergeMap, of, tap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";

@Injectable()
export class SchemaClassTableEffects {

  // The set of previously fetched class names are stored to prevent duplicate calls
  private fetchedClassNames: Set<string> = new Set();

  // getSchemaClassData$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(SchemaClassTableActions.get),
  //     // check if className has been fetched, otherwise perform call
  //     mergeMap(({className}) =>
  //       this.fetchedClassNames.has(className) ?
  //         EMPTY :
  //         this.dataService.fetchSchemaClassData(className).pipe(
  //           catchError(() => EMPTY),
  //           tap(schemaClassData => this.fetchedClassNames.add(className)),
  //           map(schemaClassData => SchemaClassTableActions.set({className, schemaClassData}),
  //           )))
  //   ), {dispatch: true}
  // );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {
  }
}
