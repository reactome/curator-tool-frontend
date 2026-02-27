import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpErrorResponse, HttpClient, HttpBackend } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, finalize, map, switchMap, take, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

@Injectable()
export class HeaderInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  private readonly refreshUrl = `${environment.authURL}/refresh`;
  private readonly httpWithoutInterceptor: HttpClient;

  constructor(private httpBackend: HttpBackend,
              private router: Router) {
    this.httpWithoutInterceptor = new HttpClient(this.httpBackend);
  }

  intercept(httpRequest: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');
    const requestToHandle = this.addAuthHeader(httpRequest, token);

    return next.handle(requestToHandle).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401 || this.isAuthRequest(requestToHandle.url)) {
          return throwError(() => error);
        }
        return this.handle401Error(requestToHandle, next);
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
        filter((token): token is string => token !== null),
        take(1),
        switchMap(token => next.handle(this.addAuthHeader(request, token)))
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return this.requestTokenRefresh().pipe(
      switchMap(newToken => {
        localStorage.setItem('token', newToken);
        this.refreshTokenSubject.next(newToken);
        return next.handle(this.addAuthHeader(request, newToken));
      }),
      catchError(error => {
        localStorage.removeItem('token');
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        if (currentUrl !== '/login') {
          sessionStorage.setItem('currentUrl', currentUrl);
        }
        this.router.navigate(['/login']);
        return throwError(() => error);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private requestTokenRefresh(): Observable<string> {
    return this.httpWithoutInterceptor.post<any>(this.refreshUrl, {}).pipe(
      map(response => {
        if (typeof response === 'string') {
          return response;
        }

        const token = response?.token || response?.accessToken;
        if (!token || typeof token !== 'string') {
          throw new Error('Token refresh response does not contain a valid token.');
        }
        return token;
      })
    );
  }

  private isAuthRequest(url: string): boolean {
    return url.includes('api/authenticate');
  }
}


