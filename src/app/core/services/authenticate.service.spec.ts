import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { AuthenticateService, authGuard } from './authenticate.service';

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
  let routerSpy: jasmine.SpyObj<Router>;

  const runGuard = (url: string) => TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const configure = (token: string | null) => {
    if (token === null)
      localStorage.removeItem('token');
    else
      localStorage.setItem('token', token);

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: routerSpy },
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
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });

  // The bug this covers: a deep link entered without a session used to be blocked here
  // without recording the target, so login always fell back to /home.
  it('saves the attempted url before redirecting to login when unauthenticated', () => {
    configure(null);

    expect(runGuard('/schema_view/instance/123?tab=referrers')).toBeFalse();
    expect(sessionStorage.getItem('currentUrl')).toBe('/schema_view/instance/123?tab=referrers');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('saves the attempted url when the stored token has expired', () => {
    configure('expired-token');

    expect(runGuard('/event_view/instance/456')).toBeFalse();
    expect(sessionStorage.getItem('currentUrl')).toBe('/event_view/instance/456');
  });

  it('does not save /login as the post-login destination', () => {
    configure(null);

    expect(runGuard('/login')).toBeFalse();
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });
});
