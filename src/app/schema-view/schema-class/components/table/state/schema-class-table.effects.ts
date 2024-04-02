import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {SchemaClassTableActions} from "./schema-class-table.actions";
import {catchError, EMPTY, map, mergeMap, of, tap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";

@Injectable()
export class SchemaClassTableEffects {

  getSchemaClass$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SchemaClassTableActions.get),
      // check if className has been fetched, otherwise perform call
      mergeMap(({className}) =>
          this.dataService.fetchSchemaClass(className).pipe(
            catchError(() => EMPTY),
            map(schemaClass => SchemaClassTableActions.set(schemaClass),
            )))
    ), {dispatch: true}
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {
  }
}
