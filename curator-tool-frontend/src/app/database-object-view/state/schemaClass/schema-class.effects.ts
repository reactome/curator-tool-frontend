import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {catchError, EMPTY, map, mergeMap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";
import {getSchemaClassList} from "./schema-class.actions";
import {Store} from "@ngrx/store";
import {setAttributeData} from "../../../attribute-table/state/attribute-table.actions";

@Injectable()
export class SchemaClassEffects {
  getSchemaClassData$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(getSchemaClassList),
        mergeMap(({className}) => this.dataService.fetchAttributeData(className)
          .pipe(
            map(attributeData => setAttributeData({className, attributeData})),
            catchError(() => EMPTY)
          )));
    }, {dispatch: true}
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService,
    private store: Store,
  ) {
  }
}
