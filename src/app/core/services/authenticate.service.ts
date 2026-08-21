import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { JwtHelperService } from '@auth0/angular-jwt';
import { CanActivateFn, Router } from "@angular/router";
import { isReturnUrlResumable, saveReturnUrl, takeReturnUrl } from "./session-url";

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

  /**
   * Ask the backend to invalidate the session and expire the HttpOnly refresh cookie.
   * The refresh cookie can only be cleared server-side (it is HttpOnly), so a client-only
   * logout leaves a stale cookie behind that later gets replayed on /refresh. `withCredentials`
   * sends the current cookie so the backend can expire it.
   */
  logout(): Observable<any> {
    return this.http.post<any>(`${environment.authURL}/logout`, {}, { withCredentials: true }).pipe(
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

  getUserCandidates(): string[] {
    const token = localStorage.getItem('token');
    const persistedLoginUsername = localStorage.getItem('login_username') || '';
    const claims = token ? (this.jwtHelper.decodeToken(token) || {}) : {};
    const candidates = [
      claims.sub,
      claims.preferred_username,
      claims.username,
      claims.user_name,
      claims.email,
      claims.upn,
      persistedLoginUsername
    ];
    return candidates
      .filter((v: unknown) => typeof v === 'string')
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0);
  }

}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticateService);
  if (authService.isAuthenticated()) {
    return true; // Allow navigation
  }

  // Remember where the user was trying to go so LoginComponent can send them there after
  // they authenticate. Without this, a deep link (pasted URL, bookmark, or any in-app
  // navigation made with an expired token) was blocked here and the saved-URL slot stayed
  // empty, so login always fell back to /home. HeaderInterceptor and
  // DataService.handleErrorMessage already do the same for the mid-session 401 case; this
  // covers the case where the navigation never even gets as far as a request.
  saveReturnUrl(state.url);

  // Redirect to login if no valid token
  const router = inject(Router);
  router.navigate(['/login']);
  return false;
};

/**
 * Keeps an already-authenticated tab off the login page, sending it to the view it was
 * waiting to resume.
 *
 * A tab torn down by an idle logout sits at /login with its intended view remembered in
 * sessionStorage, and SessionSyncService brings it back automatically once a sibling tab logs
 * in - but only for as long as the tab stays open to hear that storage event. A curator who
 * instead reloads the stale-looking window by hand (the natural reaction) short-circuits all
 * of it: the reload lands on /login, the login form comes up even though the session is
 * perfectly valid, and nothing ever consumes the remembered view. That is what "I logged in
 * on one tab, refreshed the others, and the previous links were lost" looks like from here.
 *
 * Deliberately keyed on isReturnUrlResumable() rather than on isAuthenticated(): a tab holding
 * a token the *server* has stopped accepting still looks authenticated from here, and bouncing
 * it back to the view whose request just 401'd would only 401 again. See the comment on
 * isReturnUrlResumable(). With no remembered view there is likewise nothing to resume, so the
 * login form is shown as before.
 *
 * A UrlTree rather than a navigate() call so the router treats it as a redirect and the login
 * page never renders.
 */
export const loginGuard: CanActivateFn = () => {
  if (!isReturnUrlResumable())
    return true;
  return inject(Router).parseUrl(takeReturnUrl());
};
