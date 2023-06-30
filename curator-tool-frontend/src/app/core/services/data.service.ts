import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { AttributeData, AttributTableData } from '../models/fetch-dataset.model';
import { catchError, map, Observable, throwError } from 'rxjs';
import { KeyValuePair } from '../models/key-value.model';
import { environment } from 'src/environments/environment.dev';
import { selectAttribute, selectAttributeData } from 'src/app/attribute-table/state/attribute-table.selectors';
import { MemoizedSelector, Store } from '@ngrx/store';
import { AttributeDataState } from 'src/app/attribute-table/state/attribute-table.reducers';
import { AttributeTableActions } from 'src/app/attribute-table/state/attribute-table.actions';


@Injectable({
  providedIn: 'root'
})
export class DataService {
  attributeDataurl = `${environment.ApiRoot}/getAttributes/`
  entityDataUrl = `${environment.ApiRoot}/findByDbId/`;

  constructor(private http: HttpClient, private store: Store) {
    this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA});
   }


  fetchAttributeData(className: string): Observable<AttributTableData[]> {
    return this.http.get<AttributTableData[]>(this.attributeDataurl + `${className}`)
      .pipe(catchError((err: Error) => {
        console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => err);
      }))
      .pipe(map((data: AttributTableData[]) => {
        console.log("data:")
        console.log(data)
        return data.map(value => new AttributTableData(value.category, value.definingType, value.name, value.properties))
          .sort((a, b) => a.name.localeCompare(b.name));
      }));
  }

  fetchEntityData(dbId: string): Observable<KeyValuePair[]> {
    return this.http.get<{ [key: string]: any }>(this.entityDataUrl + `${dbId}`)
      .pipe(
        catchError((err: Error) => {
          console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }),
        map(data => Object.keys(data).map(key => {
          const value = data[key];
          const type = value instanceof Array ? 'array' : typeof value;
          let dataSource = this.store.select(selectAttributeData());
          //console.log(dataSource);
          return { key, value, type }
        })));
  }
}
