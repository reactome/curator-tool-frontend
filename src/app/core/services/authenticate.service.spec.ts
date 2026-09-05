import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthenticateService, authGuard, loginGuard } from './authenticate.service';

describe('AuthenticateService', () => {
  let service: AuthenticateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        // Only expiry matters for isAuthenticated(); a stub keeps these tests off real JWTs.
        { provide: JwtHelperService, useValue: {
          isTokenExpired: (token: string) => token === 'expired-token',
          getTokenExpirationDate: () => null
        } }
      ]
    });
    service = TestBed.inject(AuthenticateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

describe('authGuard', () => {
  const runGuard = (url: string) => TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  // A real Router, not a spy: the guard's redirect is a UrlTree for the router to resolve as
  // part of the navigation already in progress, rather than an imperative router.navigate()
  // call - see the comment on authGuard for why that distinction matters (it used to leave a
  // blank page on the app's very first navigation for a signed-out visitor).
  const configure = (token: string | null) => {
    if (token === null)
      localStorage.removeItem('token');
    else
      localStorage.setItem('token', token);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: JwtHelperService, useValue: {
          isTokenExpired: (t: string) => t === 'expired-token',
          getTokenExpirationDate: () => null
        } }
      ]
    });
  };

  beforeEach(() => sessionStorage.removeItem('currentUrl'));

  afterEach(() => {
    sessionStorage.removeItem('currentUrl');
    localStorage.removeItem('token');
  });

  it('allows navigation and saves nothing when the token is valid', () => {
    configure('good-token');

    expect(runGuard('/schema_view/instance/123')).toBeTrue();
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });

  // The bug this covers: a deep link entered without a session used to be blocked here
  // without recording the target, so login always fell back to /home.
  it('saves the attempted url before redirecting to login when unauthenticated', () => {
    configure(null);

    const result = runGuard('/schema_view/instance/123?tab=referrers');

    expect(sessionStorage.getItem('currentUrl')).toBe('/schema_view/instance/123?tab=referrers');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('saves the attempted url when the stored token has expired', () => {
    configure('expired-token');

    const result = runGuard('/event_view/instance/456');

    expect(sessionStorage.getItem('currentUrl')).toBe('/event_view/instance/456');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('does not save /login as the post-login destination', () => {
    configure(null);

    const result = runGuard('/login');

    expect(sessionStorage.getItem('currentUrl')).toBeNull();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('loginGuard', () => {
  const PARKED_TOKEN_KEY = 'currentUrl_parked_token';

  const runGuard = () => TestBed.runInInjectionContext(() =>
    loginGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  /**
   * Put this tab in the state a session teardown leaves it in: parked at /login, remembering
   * the view it was showing and the token it held at the time.
   */
  const parkedAt = (url: string, parkedToken: string | null) => {
    sessionStorage.setItem('currentUrl', url);
    if (parkedToken === null)
      sessionStorage.removeItem(PARKED_TOKEN_KEY);
    else
      sessionStorage.setItem(PARKED_TOKEN_KEY, parkedToken);
  };

  beforeEach(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUrl');
    sessionStorage.removeItem(PARKED_TOKEN_KEY);
    TestBed.configureTestingModule({
      // A real Router, not a spy: the guard's redirect is a UrlTree it has to parse.
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: JwtHelperService, useValue: {
          isTokenExpired: (t: string) => t === 'expired-token',
          getTokenExpirationDate: () => null
        } }
      ]
    });
  });

  afterEach(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUrl');
    sessionStorage.removeItem(PARKED_TOKEN_KEY);
  });

  it('shows the login form when there is no session', () => {
    expect(runGuard()).toBeTrue();
  });

  // The bug this covers: after every tab was logged out by the idle timer and one of them
  // logged back in, reloading the others by hand landed on the login form even though the
  // session was valid, and their remembered views were never used.
  it('redirects a tab whose session was restored elsewhere to its remembered view', () => {
    parkedAt('/schema_view/instance/456', 'the-token-that-timed-out');
    localStorage.setItem('token', 'the-new-token');

    const result = runGuard();

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree))
      .toBe('/schema_view/instance/456');
    // One-shot, same as the post-login read in login.component.ts.
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });

  it('shows the login form when a valid session has nothing to resume', () => {
    // A deliberate logout, or the user asking for /login outright: there is no view to go back
    // to, so bouncing them anywhere would be guessing.
    localStorage.setItem('token', 'good-token');

    expect(runGuard()).toBeTrue();
  });

  // Without the token comparison this is an infinite redirect loop: DataService redirects to
  // /login on a 401 while leaving the (locally still valid) token in place, so the guard would
  // send the tab back to the page whose request just 401'd, which 401s again.
  it('shows the login form when the only token available is the one that stopped working', () => {
    parkedAt('/schema_view/instance/456', 'server-rejected-token');
    localStorage.setItem('token', 'server-rejected-token');

    expect(runGuard()).toBeTrue();
    // Still remembered, for whenever a real login does happen in this tab.
    expect(sessionStorage.getItem('currentUrl')).toBe('/schema_view/instance/456');
  });
});
