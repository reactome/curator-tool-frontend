import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpResponse, HttpRequest, HttpHandler } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

@Injectable()
export class HeaderInterceptor implements HttpInterceptor {
  intercept(httpRequest: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');
    if (token && httpRequest.url.includes('api/curation')) {
      const clonedRequest = httpRequest.clone({
        headers: httpRequest.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(clonedRequest);
    }
    return next.handle(httpRequest); // No token and pass the original request
  }
}


