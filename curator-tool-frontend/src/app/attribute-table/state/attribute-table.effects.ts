import {Injectable, Input} from "@angular/core";
import {Router} from "@angular/router";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {AttributeTableActions, getAttributeDataList, setAttributeData} from "./attribute-table.actions";
import {EMPTY, catchError, map, mergeMap, switchMap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";

@Injectable()
export class AttributeTableEffects {

  getAttributeData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getAttributeDataList),
      mergeMap(({className}) => this.attributeTableService.fetchAttributeData(className)
        .pipe(
          map(attributeData => setAttributeData({className, attributeData}),
            catchError(() => EMPTY)
          )))
    ), {dispatch: true}
  );


  constructor(
    private actions$: Actions,
    private attributeTableService: DataService,
  ) {
  }
}
