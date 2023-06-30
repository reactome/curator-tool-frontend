import { Injectable, Input } from "@angular/core";
import { Router } from "@angular/router";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { AttributeTableActions } from "./attribute-table.actions";
import { EMPTY, catchError, map, mergeMap, switchMap } from "rxjs";
import { DataService } from "src/app/core/services/data.service";

@Injectable()
export class AttributeTableEffects {
    
    getAttributeData$ = createEffect(() => {
    return this.actions$.pipe(
            ofType(AttributeTableActions.GET_ATTRIBUTE_DATA),
            mergeMap(({className}) => this.attributeTableService.fetchAttributeData(className)
            .pipe(
                map(attributeData => ({type: 
                    AttributeTableActions.SET_ATTRIBUTE_DATA, attributeData })),
                    catchError (() => EMPTY)
            )));
            }, {dispatch: true}
        );
    

    constructor(
        private actions$: Actions,
        private attributeTableService: DataService,
    ) {}
}
