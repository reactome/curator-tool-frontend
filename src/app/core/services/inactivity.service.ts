import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { AuthenticateService } from './authenticate.service';
import {
  InactivityWarningDialogComponent,
  InactivityWarningResult
} from 'src/app/shared/components/inactivity-warning-dialog/inactivity-warning-dialog.component';

/**
 * Logs the user out after a period of inactivity.
 *
 * The JWT is only validated when an API call returns 401 or when a route guard
 * runs. A user who only makes local edits (no API call, no navigation) can keep
 * an expired token indefinitely. This service watches for user activity and,
 * once none has happened for {@link INACTIVITY_TIMEOUT_MS}, warns the user with
 * a countdown dialog and then tears the session down using the same logout flow
 * the rest of the app uses.
 *
 * It also proactively keeps the session alive while the user IS active. The
 * server's refresh-token idle window (jwt.idle-token-time) only resets when
 * /api/auth/refresh is actually called, and that call was otherwise only ever
 * triggered reactively by a 401 from an api/curation request. A normal gap in
 * backend calls (reading a page, filling a form) longer than that server-side
 * window was enough to expire an actively-used session. Piggybacking a throttled
 * refresh onto the same activity signal used for the idle logout fixes that
 * without changing when the 18-minute idle logout itself kicks in.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
  /** Total idle time before the user is logged out, in milliseconds. */
  private static readonly INACTIVITY_TIMEOUT_MS = 18 * 60 * 1000;

  /** How long the "Are you still there?" warning is shown before logout, in seconds. */
  private static readonly WARNING_COUNTDOWN_SECONDS = 60;

  /**
   * Minimum gap between proactive keep-alive refreshes, in milliseconds. Must stay
   * comfortably below the server's jwt.idle-token-time (20 minutes by default) so an
   * actively-used session's refresh token never goes idle between calls.
   */
  private static readonly KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

  /** DOM events that count as "the user is active" and reset the timer. */
  private static readonly ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'click', 'wheel', 'scroll', 'keydown', 'touchstart'
  ];

  private timerId: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private loggingOut = false;
  /** Wall-clock time (ms since epoch) of the most recent user activity. */
  private lastActivityAt = Date.now();
  /** Wall-clock time (ms since epoch) of the most recent proactive keep-alive refresh. */
  private lastRefreshAt = 0;
  private warningDialogRef: MatDialogRef<InactivityWarningDialogComponent, InactivityWarningResult> | undefined;
  private readonly onActivity = () => this.resetTimer();
  private readonly onVisibilityChange = () => this.checkExpiredOnReturn();

  constructor(private zone: NgZone,
              private router: Router,
              private dialog: MatDialog,
              private userInstancesService: UserInstancesService,
              private authenticateService: AuthenticateService) {}

  /** Begin tracking activity. Safe to call more than once. */
  start(): void {
    if (this.started)
      return;
    this.started = true;
    // Login just established a fresh refresh token - skip an immediate, redundant keep-alive.
    this.lastRefreshAt = Date.now();
    console.debug(`[InactivityService] started at ${new Date(this.lastRefreshAt).toISOString()}`);
    // Register the listeners outside Angular's zone so ordinary mouse/keyboard
    // activity does not trigger change detection on every single event.
    this.zone.runOutsideAngular(() => {
      InactivityService.ACTIVITY_EVENTS.forEach(event =>
        document.addEventListener(event, this.onActivity, { passive: true })
      );
      // Timers are throttled while the tab is hidden and are frozen entirely
      // while the machine sleeps, so returning to the tab is the moment to
      // recheck whether the idle limit was blown past while we were away.
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    });
    this.resetTimer();
  }

  ngOnDestroy(): void {
    InactivityService.ACTIVITY_EVENTS.forEach(event =>
      document.removeEventListener(event, this.onActivity)
    );
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimer();
  }

  private resetTimer(): void {
    // Once the warning countdown is showing, ignore background activity: the
    // user must explicitly choose to stay logged in.
    if (this.warningDialogRef)
      return;
    this.lastActivityAt = Date.now();
    this.clearTimer();
    // Fire the warning early enough that the countdown finishes exactly at the
    // full inactivity timeout.
    const idleMs = InactivityService.INACTIVITY_TIMEOUT_MS
      - InactivityService.WARNING_COUNTDOWN_SECONDS * 1000;
    this.timerId = setTimeout(() => this.onIdle(), idleMs);
    this.maybeKeepSessionAlive();
  }

  /**
   * Proactively refresh the access/refresh tokens while the user is active, throttled to
   * at most once per KEEP_ALIVE_INTERVAL_MS. This is what stops an actively-used session
   * from tripping the server's refresh-token idle window during a stretch with no
   * api/curation calls (see the class-level comment above).
   */
  private maybeKeepSessionAlive(): void {
    if (!localStorage.getItem('token'))
      return;
    const now = Date.now();
    const sinceLastRefreshMs = now - this.lastRefreshAt;
    if (sinceLastRefreshMs < InactivityService.KEEP_ALIVE_INTERVAL_MS)
      return;
    this.lastRefreshAt = now;
    console.debug(`[InactivityService] proactive keep-alive refresh triggered at ${new Date(now).toISOString()} (${Math.round(sinceLastRefreshMs / 1000)}s since last refresh)`);
    this.authenticateService.refresh().subscribe({
      next: (token) => {
        const at = new Date().toISOString();
        if (token) {
          localStorage.setItem('token', token);
          console.debug(`[InactivityService] proactive keep-alive refresh succeeded at ${at}`);
        } else {
          console.debug(`[InactivityService] proactive keep-alive refresh returned no token at ${at}`);
        }
      },
      error: (error) => console.debug(
        `[InactivityService] proactive keep-alive refresh failed at ${new Date().toISOString()}; leaving it to the reactive refresh/idle logout.`, error)
    });
  }

  private clearTimer(): void {
    if (this.timerId !== undefined) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
  }

  private onIdle(): void {
    // Only warn/log out if the user is actually logged in. When logged out
    // (e.g. sitting on the login page) the timer simply idles and restarts on
    // the next activity.
    if (this.loggingOut || this.warningDialogRef || !localStorage.getItem('token')) {
      this.resetTimer();
      return;
    }
    // setTimeout is throttled while the tab is backgrounded and does not advance
    // while the machine sleeps, so this callback can fire well after the idle
    // deadline. Check the real wall-clock elapsed time: if the full inactivity
    // limit has already passed, the warning countdown would be pointless — the
    // user has effectively already timed out, so log them straight out.
    const idleMs = Date.now() - this.lastActivityAt;
    if (idleMs >= InactivityService.INACTIVITY_TIMEOUT_MS) {
      this.zone.run(() => this.logout());
      return;
    }
    // Re-enter Angular's zone: opening a dialog, navigating, and dispatching
    // store actions must all run inside the zone.
    this.zone.run(() => this.showWarning());
  }

  /**
   * Called when the tab becomes visible again. If the user has been idle for at
   * least the full inactivity limit while the tab was hidden/asleep, log them
   * straight out instead of letting a (possibly already-open) warning dialog sit
   * there — the grace period has effectively already elapsed.
   */
  private checkExpiredOnReturn(): void {
    if (document.visibilityState !== 'visible')
      return;
    if (this.loggingOut || !localStorage.getItem('token'))
      return;
    const idleMs = Date.now() - this.lastActivityAt;
    if (idleMs >= InactivityService.INACTIVITY_TIMEOUT_MS)
      this.zone.run(() => this.logout());
  }

  private showWarning(): void {
    this.warningDialogRef = this.dialog.open(InactivityWarningDialogComponent, {
      disableClose: true,
      data: { countdownSeconds: InactivityService.WARNING_COUNTDOWN_SECONDS }
    });
    this.warningDialogRef.afterClosed().subscribe((result) => {
      this.warningDialogRef = undefined;
      if (result === 'stay') {
        this.resetTimer();
        return;
      }
      this.logout();
    });
  }

  private logout(): void {
    if (this.loggingOut)
      return;
    this.loggingOut = true;
    // Tear down the warning dialog if it is still open (e.g. the tab was hidden
    // when its countdown was meant to expire). Clear the ref first so the
    // afterClosed handler's re-entrant logout() call is a no-op.
    if (this.warningDialogRef) {
      const ref = this.warningDialogRef;
      this.warningDialogRef = undefined;
      ref.close();
    }
    console.debug('Logging out after inactivity timeout.');
    this.userInstancesService.persistInstances(true, () => {
      // Defensively clear the session identity even if the persist call failed
      // (the JWT has likely already expired), then send the user to /login.
      localStorage.removeItem('token');
      localStorage.removeItem('login_username');
      this.loggingOut = false;
      this.resetTimer();
      this.router.navigate(['/login']);
    });
  }
}
