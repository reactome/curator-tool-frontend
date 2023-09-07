import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {catchError, EMPTY, mergeMap, Observable} from "rxjs";
import {DataService} from "src/app/core/services/data.service";
import {DatabaseObjectActions} from "./database-object.actions";
import {TypedAction} from "@ngrx/store/src/models";
import {AttributeTableActions} from "../../attribute-table/state/attribute-table.actions";
import {toClassName} from "../../core/models/schema-class-attribute-data.model";

@Injectable()
export class DatabaseObjectEffects {
  getDatabaseObjectData$: Observable<TypedAction<any>> = createEffect(() => {
      return this.actions$.pipe(
        ofType(DatabaseObjectActions.get),
        mergeMap(({dbId}) => this.dataService.fetchDatabaseObjectData(dbId)
          .pipe(
            mergeMap(databaseObject => [
              DatabaseObjectActions.set({dbId, databaseObject}),
              // Getting the className to perform the correct call for SchemaClass attribute info
              AttributeTableActions.get({className: toClassName(databaseObject.find(line => line.key === '@JavaClass')?.value)})
            ]),
            catchError(() => EMPTY)
          )));
    }, {dispatch: true}
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService,
  ) {
  }
}
