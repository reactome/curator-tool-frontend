import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpErrorResponse, HttpClient, HttpBackend } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, finalize, map, switchMap, take, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

@Injectable()
export class HeaderInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null | false>(null);
  private readonly refreshUrl = environment.refreshURL;
  private readonly httpWithoutInterceptor: HttpClient;

  constructor(private httpBackend: HttpBackend,
              private router: Router) {
    this.httpWithoutInterceptor = new HttpClient(this.httpBackend);
  }

  intercept(httpRequest: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');
    const secureRequest = this.addAuthHeader(httpRequest, token);

    return next.handle(secureRequest).pipe(
      catchError((error: HttpErrorResponse) => {
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
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter((token): token is string | false => token !== null),
        take(1),
        switchMap(token => {
          if (token === false) {
            return throwError(() => new Error('Token refresh failed'));
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
        localStorage.setItem('token', newToken);
        this.refreshTokenSubject.next(newToken);
        return next.handle(this.addAuthHeader(request, newToken));
      })
      ,
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private requestTokenRefresh(): Observable<string> {
    console.debug('Requesting token refresh');
    return this.httpWithoutInterceptor
      .post<any>(this.refreshUrl, {}, { withCredentials: true}).pipe(
        tap((token: string) => {
          console.debug('Token refreshed.');
        }),
        catchError((error: HttpErrorResponse) => this.handleRefreshFailure(error))
      );
  }

  private handleRefreshFailure(error: HttpErrorResponse): Observable<never> {
    this.refreshTokenSubject.next(false);
    localStorage.removeItem('token');
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (currentUrl !== '/login') {
      sessionStorage.setItem('currentUrl', currentUrl);
    }
    this.router.navigate(['/login']);
    return throwError(() => error);
  }

  private isAuthRequest(url: string): boolean {
    return url.includes(environment.authURL) || url.includes('api/authenticate');
  }

  private isProtectedApiRequest(url: string): boolean {
    return url.includes('api/curation');
  }
}


