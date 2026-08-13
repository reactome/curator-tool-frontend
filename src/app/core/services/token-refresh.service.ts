import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable, defer, firstValueFrom, from, of, tap, timeout } from 'rxjs';
import { environment } from 'src/environments/environment.dev';

/** The slice of the Web Locks API we use, so no DOM lib version is assumed. */
interface LockManagerLike {
  request(name: string, callback: () => Promise<string>): Promise<string>;
}

/**
 * The one place that exchanges the HttpOnly refresh cookie for a new access token, serialised
 * across every tab of this origin.
 *
 * The server treats a refresh token as single-use: POST /api/auth/refresh revokes the token it
 * was handed and issues a replacement. Both the cookie carrying that token and the access token
 * in localStorage are shared by every tab, but nothing used to stop two tabs from spending the
 * same cookie at once - and each tab's HeaderInterceptor only ever de-duplicated refreshes
 * within itself (its own isRefreshing flag). With a five-minute access token that race is the
 * common case rather than a corner case: the access token expires for every tab at the same
 * instant, so the tab the curator is working in and a tab quietly running its diagram-backup
 * interval both 401 together, both POST /refresh with the same cookie, and whichever arrives
 * second is told "Invalid or expired refresh token" even though the session is perfectly
 * healthy - a sibling tab has just minted a brand new token. The loser then tore the session
 * down for everyone (HeaderInterceptor.handleRefreshFailure removes the shared token), which is
 * what surfaced as an unexplained "you were signed out in another Webbench window" in a tab the
 * curator had only just logged into.
 *
 * The Web Locks API is a genuine cross-tab mutex, so only one tab is inside /refresh at a time,
 * and a tab that queues behind another finds the fresh token already in localStorage and reuses
 * it instead of spending the new cookie a second time. Where Web Locks is unavailable we simply
 * refresh unsynchronised: the server's rotation grace window and HeaderInterceptor's
 * sibling-token recovery both still apply, so a lost race stays survivable.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  static readonly TOKEN_KEY = 'token';

  private static readonly LOCK_NAME = 'webbench-token-refresh';

  /** Cap on one /refresh call, so a wedged request cannot hold the cross-tab lock indefinitely. */
  private static readonly REFRESH_TIMEOUT_MS = 20_000;

  private readonly refreshUrl = environment.authURL + '/refresh';
  private readonly httpWithoutInterceptor: HttpClient;

  constructor(httpBackend: HttpBackend,
              private jwtHelper: JwtHelperService) {
    // Bypass the interceptor chain: HeaderInterceptor depends on this service, and a refresh
    // must never be able to trigger another refresh.
    this.httpWithoutInterceptor = new HttpClient(httpBackend);
  }

  /**
   * Refresh the session, waiting for any refresh already running in another tab. Emits the token
   * to use - either the one this call obtained or the one a sibling tab just obtained - and has
   * already written it to localStorage by the time it emits.
   */
  refresh(): Observable<string> {
    // defer() so the "what did we start from" snapshot is taken when the caller subscribes,
    // not when the observable is built, and so no lock is taken for a call nobody subscribes to.
    return defer(() => {
      const tokenBeforeRefresh = localStorage.getItem(TokenRefreshService.TOKEN_KEY);
      const locks = (navigator as unknown as { locks?: LockManagerLike }).locks;
      if (!locks?.request) {
        console.debug('Web Locks API unavailable; refreshing the token without cross-tab coordination.');
        return this.requestRefresh();
      }
      return from(locks.request(
        TokenRefreshService.LOCK_NAME,
        () => firstValueFrom(this.reuseSiblingTokenOrRefresh(tokenBeforeRefresh))
      ));
    });
  }

  /** True when `token` exists and has not expired. */
  isTokenValid(token: string | null): boolean {
    if (!token)
      return false;
    try {
      return !this.jwtHelper.isTokenExpired(token);
    } catch {
      return false;
    }
  }

  /**
   * Runs while holding the cross-tab lock. If we queued behind another tab's refresh, that tab
   * has already replaced the shared token with a valid one - use it rather than rotating the
   * cookie again for no reason.
   */
  private reuseSiblingTokenOrRefresh(tokenBeforeRefresh: string | null): Observable<string> {
    const currentToken = localStorage.getItem(TokenRefreshService.TOKEN_KEY);
    if (currentToken && currentToken !== tokenBeforeRefresh && this.isTokenValid(currentToken)) {
      console.debug('Another tab refreshed the session while this tab waited for the refresh lock; reusing its token.');
      return of(currentToken);
    }
    return this.requestRefresh();
  }

  private requestRefresh(): Observable<string> {
    console.debug('Requesting token refresh at', new Date().toLocaleString());
    return this.httpWithoutInterceptor
      .post<any>(this.refreshUrl, {}, { withCredentials: true })
      .pipe(
        timeout(TokenRefreshService.REFRESH_TIMEOUT_MS),
        tap((token: string) => {
          // Store the new token here rather than in the caller: tabs waiting on the lock read
          // it straight from localStorage, and it must land even if the caller that triggered
          // the refresh has since been torn down (a closed dialog, an abandoned route).
          if (token)
            localStorage.setItem(TokenRefreshService.TOKEN_KEY, token);
          console.debug('Token refreshed at', new Date().toLocaleString());
        })
      );
  }
}
