import {Injectable} from "@angular/core";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {AttributeTableActions} from "./attribute-table.actions";
import {catchError, EMPTY, map, mergeMap, of, tap} from "rxjs";
import {DataService} from "src/app/core/services/data.service";

@Injectable()
export class AttributeTableEffects {

  // The set of previously fetched class names are stored to prevent duplicate calls
  private fetchedClassNames: Set<string> = new Set();

  getAttributeData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AttributeTableActions.get),
      // check if className has been fetched, otherwise perform call
      mergeMap(({className}) =>
        this.fetchedClassNames.has(className) ?
          EMPTY :
          this.dataService.fetchAttributeData(className).pipe(
            catchError(() => EMPTY),
            tap(attributeData => this.fetchedClassNames.add(className)),
            map(attributeData => AttributeTableActions.set({className, attributeData}),
            )))
    ), {dispatch: true}
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {
  }
}
