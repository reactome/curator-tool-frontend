import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {catchError, EMPTY, mergeMap, Observable} from "rxjs";
import {DataService} from "src/app/core/services/data.service";
import {EntriesTableActions, setEntriesData} from "./entries-table.actions";
import {TypedAction} from "@ngrx/store/src/models";
import {AttributeTableActions} from "../../attribute-table/state/attribute-table.actions";
import {toClassName} from "../../core/models/schema-class-attribute-data.model";

@Injectable()
export class EntriesTableEffects {
  getEntriesData$: Observable<TypedAction<any>> = createEffect(() => {
      return this.actions$.pipe(
        ofType(EntriesTableActions.GET_ENTRIES_DATA),
        mergeMap(({dbId}) => this.dataService.fetchEntityData(dbId)
          .pipe(
            mergeMap(entriesData => [
              setEntriesData({dbId, entriesData}),
              AttributeTableActions.get({className: toClassName(entriesData.find(line => line.key === '@JavaClass')?.value)})
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
