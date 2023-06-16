import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
// import {MatSnackBar, MatSnackBarModule} from "@angular/material/snack-bar";
import { AttributTableData } from '../models/fetch-dataset.model';
import {catchError, map, Observable, throwError } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private http: HttpClient) { }


    fetchExampleData(className: string): Observable<AttributTableData[]> {
      return this.http.get<AttributTableData[]>(`http://localhost:8080/api/curation/getAttributes/${className}`)
        .pipe(catchError((err: Error) => {
          console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(err);    //Rethrow it back to component
        }))
        .pipe(map((data: AttributTableData[]) => {
          return data.map(value => new AttributTableData(value.name));
        }));
    }
}
