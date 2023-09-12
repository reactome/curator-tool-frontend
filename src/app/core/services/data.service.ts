import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import {SchemaClassData} from '../models/schema-class-attribute-data.model';
import {catchError, map, Observable, pipe, throwError} from 'rxjs';
import { DatabaseObject } from '../models/database-object-attribute.model';
import { environment } from 'src/environments/environment.dev';


@Injectable({
  providedIn: 'root'
})
export class DataService {
  schemaClassDataUrl = `${environment.ApiRoot}/getAttributes/`
  entityDataUrl = `${environment.ApiRoot}/findByDbId/`;

  constructor(private http: HttpClient) {
   }


  fetchSchemaClassData(className: string): Observable<SchemaClassData[]> {
    return this.http.get<SchemaClassData[]>(this.schemaClassDataUrl + `${className}`)
      .pipe(catchError((err: Error) => {
        console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => err);
      }))
      .pipe(map((data: SchemaClassData[]) => {
        console.log("dts:")
        console.log(data)
        return data;
      }));
  }

  fetchDatabaseObjectData(dbId: string): Observable<DatabaseObject[]> {
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
          const javaType = "";
          return { key, value, type, javaType };
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
