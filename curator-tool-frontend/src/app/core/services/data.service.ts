import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { AttributTableData } from '../models/schema-class-attribute-data.model';
import {catchError, map, Observable, pipe, throwError} from 'rxjs';
import { EntryData } from '../models/entry-data.model';
import { environment } from 'src/environments/environment.dev';


@Injectable({
  providedIn: 'root'
})
export class DataService {
  attributeDataurl = `${environment.ApiRoot}/getAttributes/`
  entityDataUrl = `${environment.ApiRoot}/findByDbId/`;

  constructor(private http: HttpClient) {
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
        console.log("dts:")
        console.log(data)
        return data.map(value => new AttributTableData(value.category, value.definingType, value.name, value.properties))
          .sort((a, b) => a.name.localeCompare(b.name));
      }));
  }

  fetchEntityData(dbId: string): Observable<EntryData[]> {
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
          console.log(data);
          return { key, value, type }
        })));
  }

  fetchSchemaClasses(): Observable<string[]> {
    let stringArray: string[] = [];
    return this.http.get<string[]>(`http://localhost:8080/api/curation/getSchemaClasses`)
      .pipe(map((data: string[]) => {
        return data;
      }));
  }
}
