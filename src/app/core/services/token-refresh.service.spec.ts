import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { JwtHelperService } from '@auth0/angular-jwt';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

import { TokenRefreshService } from './token-refresh.service';

describe('TokenRefreshService', () => {
  const refreshUrl = environment.authURL + '/refresh';

  let service: TokenRefreshService;
  let httpMock: HttpTestingController;

  /**
   * Replace navigator.locks for one test. Defining an own property shadows the real
   * (prototype-level) accessor, and deleting it in afterEach uncovers it again.
   */
  const useLocks = (locks: unknown) =>
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });

  /** A lock that is free: run the callback straight away. */
  const uncontendedLock = {
    request: (_name: string, callback: () => Promise<string>) => callback()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        // Only expiry matters here, and a stub keeps the tests off real JWT payloads.
        { provide: JwtHelperService, useValue: { isTokenExpired: (token: string) => token === 'expired-token' } }
      ]
    });
    service = TestBed.inject(TokenRefreshService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.removeItem('token');
  });

  afterEach(() => {
    httpMock.verify();
    delete (navigator as any).locks;
    localStorage.removeItem('token');
  });

  it('stores the refreshed token so every tab, and any waiting caller, can see it', async () => {
    useLocks(uncontendedLock);
    localStorage.setItem('token', 'old-token');

    const refreshed = firstValueFrom(service.refresh());
    httpMock.expectOne(refreshUrl).flush('new-token');

    expect(await refreshed).toBe('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
  });

  it('sends the refresh with credentials, so the HttpOnly cookie goes along', async () => {
    useLocks(uncontendedLock);

    const refreshed = firstValueFrom(service.refresh());
    const request = httpMock.expectOne(refreshUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    request.flush('new-token');
    await refreshed;
  });

  it('reuses the token a sibling tab produced while this tab waited for the lock', async () => {
    // Refresh tokens are single-use: spending the cookie again here is exactly the race that
    // used to sign the curator out of every tab.
    useLocks({
      request: async (_name: string, callback: () => Promise<string>) => {
        localStorage.setItem('token', 'sibling-token');
        return callback();
      }
    });
    localStorage.setItem('token', 'old-token');

    const refreshed = firstValueFrom(service.refresh());

    expect(await refreshed).toBe('sibling-token');
    httpMock.expectNone(refreshUrl);
  });

  it('refreshes anyway when the token a sibling left behind has expired', async () => {
    useLocks({
      request: async (_name: string, callback: () => Promise<string>) => {
        localStorage.setItem('token', 'expired-token');
        return callback();
      }
    });
    localStorage.setItem('token', 'old-token');

    const refreshed = firstValueFrom(service.refresh());
    await Promise.resolve();
    httpMock.expectOne(refreshUrl).flush('new-token');

    expect(await refreshed).toBe('new-token');
  });

  it('still refreshes where the Web Locks API is unavailable', async () => {
    useLocks(undefined);
    localStorage.setItem('token', 'old-token');

    const refreshed = firstValueFrom(service.refresh());
    httpMock.expectOne(refreshUrl).flush('new-token');

    expect(await refreshed).toBe('new-token');
  });

  it('takes no lock and sends no request until subscribed', () => {
    const requestSpy = jasmine.createSpy('request').and.callFake(uncontendedLock.request);
    useLocks({ request: requestSpy });

    service.refresh();

    expect(requestSpy).not.toHaveBeenCalled();
    httpMock.expectNone(refreshUrl);
  });

  it('reports an unusable token as invalid', () => {
    expect(service.isTokenValid(null)).toBeFalse();
    expect(service.isTokenValid('expired-token')).toBeFalse();
    expect(service.isTokenValid('good-token')).toBeTrue();
  });
});
