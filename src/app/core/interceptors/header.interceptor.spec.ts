import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, defer, firstValueFrom, of, throwError } from 'rxjs';

import { TokenRefreshService } from '../services/token-refresh.service';
import { HeaderInterceptor } from './header.interceptor';

describe('HeaderInterceptor', () => {
  const url = 'http://localhost:9090/api/curation/instance/123';

  let interceptor: HeaderInterceptor;
  let router: { navigate: jasmine.Spy };
  let tokenRefresh: jasmine.SpyObj<TokenRefreshService>;
  /** Every request the interceptor sent onwards, in order. */
  let handled: HttpRequest<any>[];

  /** A downstream handler that fails the first `failures` requests with a 401, then succeeds. */
  const handlerFailingWith401 = (failures: number, finalStatus = 200): HttpHandler => ({
    handle: (request: HttpRequest<any>): Observable<HttpEvent<any>> => {
      handled.push(request);
      if (handled.length <= failures)
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      if (finalStatus >= 400)
        return throwError(() => new HttpErrorResponse({ status: finalStatus }));
      return of(new HttpResponse({ status: finalStatus, body: 'ok' }));
    }
  });

  beforeEach(() => {
    handled = [];
    router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    tokenRefresh = jasmine.createSpyObj<TokenRefreshService>('TokenRefreshService', ['refresh', 'isTokenValid']);
    tokenRefresh.isTokenValid.and.callFake((token: string | null) => !!token && token !== 'dead-token');
    interceptor = new HeaderInterceptor(tokenRefresh, router as unknown as Router);
    localStorage.setItem('token', 'old-token');
    sessionStorage.removeItem('currentUrl');
  });

  afterEach(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUrl');
  });

  it('retries once with the same token before spending a refresh', async () => {
    const response = await firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(1)));

    expect((response as HttpResponse<any>).body).toBe('ok');
    expect(tokenRefresh.refresh).not.toHaveBeenCalled();
    expect(handled.length).toBe(2);
  });

  it('carries on with the token a sibling tab produced when its own refresh loses the race', async () => {
    // Refresh tokens are single-use and their cookie is shared by every tab, so the tab that
    // arrives second at /refresh is rejected moments after a sibling minted a perfectly good
    // token. Giving up here used to log the curator out of every tab, the one in use included.
    tokenRefresh.refresh.and.returnValue(defer(() => {
      localStorage.setItem('token', 'sibling-token');
      return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Invalid or expired refresh token' }));
    }));

    const response = await firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(2)));

    expect((response as HttpResponse<any>).body).toBe('ok');
    expect(handled[2].headers.get('Authorization')).toBe('Bearer sibling-token');
    expect(localStorage.getItem('token')).toBe('sibling-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ends the session when a failed refresh leaves nothing usable behind', async () => {
    tokenRefresh.refresh.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Invalid or expired refresh token' })));

    await expectAsync(firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(2)))).toBeRejected();

    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(sessionStorage.getItem('currentUrl')).toBeTruthy();
  });

  it('ends the session when the token left behind is itself expired', async () => {
    tokenRefresh.refresh.and.returnValue(defer(() => {
      localStorage.setItem('token', 'dead-token');
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    }));

    await expectAsync(firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(2)))).toBeRejected();

    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('reports a failure of the retried request itself, rather than treating it as a dead session', async () => {
    tokenRefresh.refresh.and.returnValue(defer(() => {
      localStorage.setItem('token', 'new-token');
      return of('new-token');
    }));

    await expectAsync(firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(2, 500))))
      .toBeRejectedWith(jasmine.objectContaining({ status: 500 }));

    expect(localStorage.getItem('token')).toBe('new-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('retries the original request with the refreshed token', async () => {
    tokenRefresh.refresh.and.returnValue(defer(() => {
      localStorage.setItem('token', 'new-token');
      return of('new-token');
    }));

    const response = await firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', url), handlerFailingWith401(2)));

    expect((response as HttpResponse<any>).body).toBe('ok');
    expect(handled[2].headers.get('Authorization')).toBe('Bearer new-token');
  });

  it('leaves requests that are not protected api/curation calls alone', async () => {
    await expectAsync(firstValueFrom(interceptor.intercept(
      new HttpRequest('GET', 'http://localhost:9090/api/other/thing'), handlerFailingWith401(1)))).toBeRejected();

    expect(tokenRefresh.refresh).not.toHaveBeenCalled();
    expect(handled[0].headers.has('Authorization')).toBeFalse();
  });
});
