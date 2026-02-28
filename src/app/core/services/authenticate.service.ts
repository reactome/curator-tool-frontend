import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { JwtHelperService } from '@auth0/angular-jwt';
import { CanActivateFn, Router } from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class AuthenticateService {

  constructor(private http: HttpClient,
    private jwtHelper: JwtHelperService) { }

  login(data: { username: string, password: string }): Observable<string> {
    return this.http.post<any>(`${environment.authURL}/login`, data, { withCredentials: true }).pipe(
      tap((token: string) => token),
      catchError(err => throwError(() => err))
    )
  }

  // register(data: { username: string, password: string }): Observable<any> {
  //   return this.http.post<any>(`${environment.authURL}/register`, data).pipe(
  //     tap((data: any) => data),
  //     catchError(err => throwError(() => err))
  //   )
  // }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    if (!token)
      return false;
    console.debug(this.jwtHelper.getTokenExpirationDate(token!));
    if (token && !this.jwtHelper.isTokenExpired(token))
      return true;
    return false;
  }

  getUser(): string | undefined {
    const token = localStorage.getItem('token');
    if (token) {
      return this.jwtHelper.decodeToken(token).sub;
    }
    return undefined;
  }

}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticateService);
  if (authService.isAuthenticated()) {
    return true; // Allow navigation
  }

  // Redirect to login if no valid token
  const router = inject(Router);
  router.navigate(['/login']);
  return false;
};
