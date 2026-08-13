import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, finalize, of, switchMap, take, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { TokenRefreshService } from '../services/token-refresh.service';

// Marks a request that has already been transparently retried once after a 401 while the
// stored JWT was still valid, so we never retry the same request in an endless loop.
const RETRIED_AFTER_401 = new HttpContextToken<boolean>(() => false);

@Injectable()
export class HeaderInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null | false>(null);

  constructor(private tokenRefreshService: TokenRefreshService,
              private router: Router) {}

  intercept(httpRequest: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');
    const secureRequest = this.addAuthHeader(httpRequest, token);

    return next.handle(secureRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // A status of 0 means the request never reached the server (network down,
        // server unreachable, CORS/connection failure). Treat this as a lost
        // connection on any request and bounce the user to /login, saving where
        // they were so they land back there once they re-authenticate. Auth
        // requests are excluded so a failed login/refresh doesn't loop us back
        // to a page we're already on.
        if (error.status === 0 &&
            !this.isAuthRequest(secureRequest.url)) {
          console.warn('Connection to the server was lost; redirecting to login.');
          this.redirectToLogin();
          return throwError(() => error);
        }
        if (error.status !== 401 ||
            this.isAuthRequest(secureRequest.url) ||
            !this.isProtectedApiRequest(secureRequest.url)) {
          return throwError(() => error);
        }
        return this.handle401Error(secureRequest, next);
      })
    );
  }

  private addAuthHeader(request: HttpRequest<any>, token: string | null): HttpRequest<any> {
    if (token && request.url.includes('api/curation')) {
      return request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
    }
    return request;
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // If the stored JWT is still valid, this 401 is almost certainly a transient race —
    // e.g. bootstrap api/curation requests fired right after login, before the backend
    // session is fully established. Retry the original request once with the same token
    // instead of firing /refresh against a refresh cookie the backend may not accept yet
    // (that is what surfaced "Invalid or expired refresh token" on the first login). Only
    // fall back to a real token refresh when the retry also 401s or the token is expired.
    if (this.isStoredTokenValid() && !request.context.get(RETRIED_AFTER_401)) {
      console.warn('Received a 401 while the stored token is still valid; retrying the request once before attempting a token refresh.');
      const retried = request.clone({ context: request.context.set(RETRIED_AFTER_401, true) });
      return next.handle(retried).pipe(
        catchError((retryError: HttpErrorResponse) =>
          retryError.status === 401
            ? this.refreshTokenAndRetry(request, next)
            : throwError(() => retryError))
      );
    }
    return this.refreshTokenAndRetry(request, next);
  }

  private refreshTokenAndRetry(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter((token): token is string | false => token !== null),
        take(1),
        switchMap(token => {
          if (token === false) {
            return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Token refresh failed' }));
          }
          return next.handle(this.addAuthHeader(request, token));
        })
      );
    }

    this.isRefreshing = true;
    // Reset the refresh token subject to null so that subsequent requests will wait until the new token is available
    this.refreshTokenSubject.next(null);
    // Snapshot the token this refresh starts from, so a failure can tell "the session is gone"
    // apart from "another tab refreshed first and this cookie is simply spent" (see
    // recoverFromRefreshFailure).
    const tokenBeforeRefresh = localStorage.getItem('token');

    return this.tokenRefreshService.refresh().pipe(
      switchMap(newToken => newToken
        ? of(newToken)
        : throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Token refresh failed' }))),
      // Deliberately placed before the retry below, so it only ever sees failures of the refresh
      // itself - never an error from the retried request, which must be reported as-is.
      catchError(error => this.recoverFromRefreshFailure(tokenBeforeRefresh, error)),
      switchMap(token => {
        // TokenRefreshService has already stored the token; publishing it here releases the
        // requests that queued behind this refresh.
        this.refreshTokenSubject.next(token);
        return next.handle(this.addAuthHeader(request, token));
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  /**
   * A failed refresh does not always mean a dead session. Refresh tokens are single-use and the
   * cookie holding them is shared by every tab, so a tab that loses a refresh race is told
   * "Invalid or expired refresh token" moments after a sibling tab minted a perfectly good
   * token. Tearing the session down on that used to log every tab out - including the one the
   * curator was working in, which reported it as being signed out in another window. So check
   * for a newer, still-valid token before giving up; only a refresh failure that leaves us with
   * nothing usable ends the session.
   */
  private recoverFromRefreshFailure(tokenBeforeRefresh: string | null, error: any): Observable<string> {
    const currentToken = localStorage.getItem('token');
    if (currentToken
        && currentToken !== tokenBeforeRefresh
        && this.tokenRefreshService.isTokenValid(currentToken)) {
      console.warn('Token refresh failed, but another tab has already refreshed this session; continuing with its token.');
      return of(currentToken);
    }
    return this.handleRefreshFailure(error);
  }

  private handleRefreshFailure(error: any): Observable<never> {
    this.refreshTokenSubject.next(false);

    // We only reach here once every cheaper explanation has been ruled out: the original 401
    // was retried once with the same token (see handle401Error), a token refresh was then
    // attempted and failed, and no sibling tab has left a newer usable token behind (see
    // recoverFromRefreshFailure). At that point the server will no longer accept our
    // credentials, so the session is genuinely gone — tear it down and redirect to /login even
    // if the locally stored JWT has not expired yet (a locally-valid-but-server-rejected token
    // would otherwise loop on 401s forever without ever redirecting).
    localStorage.removeItem('token');
    this.redirectToLogin();
    return throwError(() => error);
  }

  // Saves the page the user is currently on (so the login flow can send them back
  // there afterwards) and redirects to /login. Skips saving when already on /login.
  private redirectToLogin(): void {
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (currentUrl !== '/login') {
      sessionStorage.setItem('currentUrl', currentUrl);
    }
    this.router.navigate(['/login']);
  }

  private isStoredTokenValid(): boolean {
    return this.tokenRefreshService.isTokenValid(localStorage.getItem('token'));
  }

  private isAuthRequest(url: string): boolean {
    return url.includes(environment.authURL);
  }

  private isProtectedApiRequest(url: string): boolean {
    return url.includes('api/curation');
  }
}


