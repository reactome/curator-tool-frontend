import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { EMPTY, catchError, map, mergeMap } from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { SchemaClassActions } from "./schema-class.actions";
import { Store } from "@ngrx/store";
import { selectAttributeData } from "src/app/attribute-table/state/attribute-table.selectors";

@Injectable()
export class SchemaClassEffects {
    getSchemaClassData$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(SchemaClassActions.GET_SCHEMA_CLASS_DATA),
            mergeMap(() => this.store.select(selectAttributeData())
                .pipe(
                    map(attributeData => ({
                        type: SchemaClassActions.SET_SCHEMA_CLASS_DATA, attributeData
                    })),
                    catchError(() => EMPTY)
                )));
    }, { dispatch: true }
    );

    constructor(
        private actions$: Actions,
        private dataService: DataService,
        private store: Store,
    ) { }
}