import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';

/**
 * Propagates a logout to every other tab/window of this app.
 *
 * The session identity lives in localStorage ('token'), which is shared by every tab on
 * the origin, but nothing was watching it. So a tab that logged out - or had its session
 * torn down by a failed token refresh - silently pulled the token out from under its
 * siblings: those tabs kept rendering an authenticated UI, kept accepting edits, and only
 * found out the session was gone when a request finally failed. That is how "launch
 * instance" into a second window, log out there, then come back and commit in the first
 * window ends in an unexplained server error on commit rather than a clean login prompt.
 *
 * localStorage's 'storage' event fires in every *other* tab of the origin (never in the one
 * that made the change), which makes it the natural broadcast channel - the same mechanism
 * InstanceEffects and UserInstancesService already use to keep staged edits in sync. Here we
 * only care about the token disappearing; when it does, this tab tears itself down the same
 * way the auth interceptor does on a dead session: stash where the user was, close any open
 * dialogs, and send them to /login.
 */
@Injectable({ providedIn: 'root' })
export class SessionSyncService implements OnDestroy {
  private static readonly TOKEN_KEY = 'token';

  private started = false;
  private tearingDown = false;
  private readonly onStorage = (event: StorageEvent) => this.handleStorageEvent(event);

  constructor(private zone: NgZone,
              private router: Router,
              private dialog: MatDialog) {}

  /** Begin listening for logouts in sibling tabs. Safe to call more than once. */
  start(): void {
    if (this.started)
      return;
    this.started = true;
    window.addEventListener('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
  }

  private handleStorageEvent(event: StorageEvent): void {
    // The two shapes a logout takes in a sibling tab: localStorage.clear() (the normal
    // logout path in UserInstancesService.persistInstances) reports key === null, while
    // localStorage.removeItem('token') (InactivityService, and the interceptor giving up
    // on a refresh) reports the key with a null newValue. A login writing a fresh token
    // also arrives under the 'token' key, hence the newValue check.
    const clearedEverything = event.key === null;
    const clearedToken = event.key === SessionSyncService.TOKEN_KEY && !event.newValue;
    if (!clearedEverything && !clearedToken)
      return;
    // Re-read the current value rather than trusting the event: logout clears and then
    // restores a few preserved keys, and a sibling tab may already have logged back in.
    if (localStorage.getItem(SessionSyncService.TOKEN_KEY))
      return;
    // Storage events fire outside Angular's zone in some browsers; routing and dialogs
    // must run inside it.
    this.zone.run(() => this.endSession());
  }

  private endSession(): void {
    if (this.tearingDown)
      return;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (currentUrl === '/login' || this.router.url.startsWith('/login'))
      return;
    this.tearingDown = true;
    console.debug('Session was ended in another tab; logging out this tab as well.');
    // Save where the user was so re-authenticating lands them back here, matching what
    // HeaderInterceptor does when it gives up on a session.
    sessionStorage.setItem('currentUrl', currentUrl);
    // Close anything still open - a selection dialog, a wizard, the inactivity warning.
    // Leaving them up is what makes the tab look like it is still accepting work.
    this.dialog.closeAll();
    this.router.navigate(['/login']).then(
      () => this.notifyLoggedOut(),
      () => this.notifyLoggedOut()
    );
  }

  private notifyLoggedOut(): void {
    this.tearingDown = false;
    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Signed out',
        message: 'You were signed out in another Webbench window, so this window has been '
          + 'signed out too. Please log in again to continue.',
        instanceInfo: ''
      }
    });
  }
}
