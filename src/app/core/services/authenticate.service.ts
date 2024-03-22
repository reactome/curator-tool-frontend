import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { JwtHelperService } from '@auth0/angular-jwt';
import {Router} from "@angular/router";
@Injectable({
  providedIn: 'root'
})
export class AuthenticateService {

  constructor(private http: HttpClient,
              private jwtHelper: JwtHelperService,
              private router: Router) {}

  login(data: {email: string, password: string}): Observable<any> {
    return this.http.post<any>(`${environment.authURL}`, data).pipe(
      tap((data: any) => data),
      catchError(err => throwError(() => err))
    )
  }

  register(data: {email: string, password: string}): Observable<any> {
    return this.http.post<any>(`${environment.authURL}/register`, data).pipe(
      tap((data: any) => data),
      catchError(err => throwError(() => err))
    )
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token') ?? '';
    // Check whether the token is expired and return
    // true or false
    return !this.jwtHelper.isTokenExpired(token);
  }

  logout(){
    let removeToken = localStorage.removeItem('token');
    sessionStorage.setItem('authenticated', 'false');
    if(removeToken === null){this.router.navigate(['login'])}
  }

}
