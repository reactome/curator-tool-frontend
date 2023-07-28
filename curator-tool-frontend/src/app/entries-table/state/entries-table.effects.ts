import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {EMPTY, catchError, map, mergeMap, Observable} from "rxjs";
import {DataService} from "src/app/core/services/data.service";
import {EntriesTableActions, setEntriesData} from "./entries-table.actions";
import {EntryData} from "../../core/models/entry-data.model";
import {TypedAction} from "@ngrx/store/src/models";

@Injectable()
export class EntriesTableEffects {
  getEntriesData$: Observable<TypedAction<any>> = createEffect(() => {
      return this.actions$.pipe(
        ofType(EntriesTableActions.GET_ENTRIES_DATA),
        mergeMap(({dbId}) => this.dataService.fetchEntityData(dbId)
          .pipe(
            map(entriesData => setEntriesData({dbId, entriesData})),
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
