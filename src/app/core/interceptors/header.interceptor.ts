import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpErrorResponse, HttpClient, HttpBackend, HttpContextToken } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, finalize, switchMap, take, tap, throwError } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment.dev';

// Marks a request that has already been transparently retried once after a 401 while the
// stored JWT was still valid, so we never retry the same request in an endless loop.
const RETRIED_AFTER_401 = new HttpContextToken<boolean>(() => false);

@Injectable()
export class HeaderInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null | false>(null);
  private readonly refreshUrl = environment.authURL + '/refresh';
  private readonly httpWithoutInterceptor: HttpClient;

  constructor(private httpBackend: HttpBackend,
              private jwtHelper: JwtHelperService,
              private router: Router) {
    this.httpWithoutInterceptor = new HttpClient(this.httpBackend);
  }

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

    return this.requestTokenRefresh().pipe(
      switchMap(newToken => {
        if (!newToken) {
          return this.handleRefreshFailure(new HttpErrorResponse({ status: 401, statusText: 'Token refresh failed' }));
        }
        localStorage.setItem('token', newToken);
        this.refreshTokenSubject.next(newToken);
        return next.handle(this.addAuthHeader(request, newToken));
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private requestTokenRefresh(): Observable<string> {
    console.debug('Requesting token refresh at', new Date().toLocaleString());
    return this.httpWithoutInterceptor
      .post<any>(this.refreshUrl, {}, { withCredentials: true}).pipe(
        tap((token: string) => {
          console.debug('Token refreshed at', new Date().toLocaleString());
        }),
        catchError((error: HttpErrorResponse) => this.handleRefreshFailure(error))
      );
  }

  private handleRefreshFailure(error: HttpErrorResponse): Observable<never> {
    this.refreshTokenSubject.next(false);

    // We only reach here after the transient-race protection has already run: the
    // original 401 was retried once with the same token (see handle401Error) and a
    // token refresh was then attempted and failed. A failed refresh means the server
    // will no longer accept our credentials, so the session is genuinely gone — tear
    // it down and redirect to /login even if the locally stored JWT has not expired
    // yet (a locally-valid-but-server-rejected token would otherwise loop on 401s
    // forever without ever redirecting).
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
    const token = localStorage.getItem('token');
    if (!token)
      return false;
    try {
      return !this.jwtHelper.isTokenExpired(token);
    } catch {
      return false;
    }
  }

  private isAuthRequest(url: string): boolean {
    return url.includes(environment.authURL);
  }

  private isProtectedApiRequest(url: string): boolean {
    return url.includes('api/curation');
  }
}


