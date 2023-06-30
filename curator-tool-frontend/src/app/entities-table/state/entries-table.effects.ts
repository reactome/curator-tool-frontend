import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { EMPTY, catchError, map, mergeMap } from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { EntriesTableActions } from "./entries-table.actions";

@Injectable()
export class EntriesTableEffects {
    getEntriesData$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(EntriesTableActions.GET_ENTRIES_DATA),
            mergeMap(({ dbId }) => this.dataService.fetchEntityData(dbId)
                .pipe(
                    map(entriesData => ({
                        type:
                        EntriesTableActions.SET_ENTRIES_DATA, entriesData
                    })),
                    catchError(() => EMPTY)
                )));
    }, { dispatch: true }
    );

    constructor(
        private actions$: Actions,
        private dataService: DataService,
    ) { }
}