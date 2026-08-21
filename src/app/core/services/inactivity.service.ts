import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { TokenRefreshService } from './token-refresh.service';
import { saveReturnUrl } from './session-url';
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
 *
 * Idleness is a property of the *session*, not of one tab. Activity events only reach the
 * document the curator is actually typing in, while the token being watched lives in
 * localStorage and is shared by every tab - and this app opens instances in new tabs all over
 * the place. So a second tab, which by definition sees no activity while it sits behind the one
 * in use, used to time out after 18 minutes and clear the shared token, logging the curator out
 * of the window they were working in - with its warning countdown running invisibly behind that
 * window, so the only thing they ever saw was an abrupt "signed out in another window". The last
 * activity timestamp is therefore published to localStorage, and every idle decision is made
 * against the most recent activity in *any* tab.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
  /** Total idle time before the user is logged out, in milliseconds. */
  private static readonly INACTIVITY_TIMEOUT_MS = 18 * 60 * 1000;

  /** localStorage key through which tabs publish their most recent user activity. */
  private static readonly LAST_ACTIVITY_KEY = 'last_activity_at';

  /**
   * Minimum gap between writes of {@link LAST_ACTIVITY_KEY}. Activity events arrive in floods,
   * and the shared timestamp only has to be accurate to well within the idle timeout.
   */
  private static readonly ACTIVITY_PUBLISH_INTERVAL_MS = 5 * 1000;

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
  /** Wall-clock time (ms since epoch) at which this tab last published its activity. */
  private lastActivityPublishedAt = 0;
  private warningDialogRef: MatDialogRef<InactivityWarningDialogComponent, InactivityWarningResult> | undefined;
  private readonly onActivity = () => this.resetTimer();
  private readonly onVisibilityChange = () => this.checkExpiredOnReturn();
  private readonly onStorage = (event: StorageEvent) => this.handleSiblingActivity(event);

  constructor(private zone: NgZone,
              private router: Router,
              private dialog: MatDialog,
              private userInstancesService: UserInstancesService,
              private tokenRefreshService: TokenRefreshService) {}

  /**
   * Begin tracking activity. Safe to call more than once.
   *
   * Returns whether the session was already idle past the timeout when this tab opened (in
   * which case logout() has just been kicked off asynchronously). Callers should check this
   * before firing anything that would otherwise use the about-to-be-invalidated token for an
   * authenticated request - e.g. loading the user's staged instances at app startup - since
   * that request would race the logout rather than being reliably skipped by it.
   */
  start(): boolean {
    if (this.started)
      return false;
    this.started = true;
    // last_activity_at is only ever compared against the current time by a live timer, a
    // visibilitychange handler, or this check - all of which need a tab open to run at all.
    // If every tab was closed for longer than the timeout, nothing was watching to catch that
    // in time, and the app would otherwise treat this fresh page load as if it were itself
    // proof of recent activity. Catch that here instead, before anything else runs.
    const wasAlreadyIdle = !!localStorage.getItem('token') && this.isAlreadyIdlePastTimeout();
    if (wasAlreadyIdle) {
      console.debug('[InactivityService] session was already idle past the timeout when this tab opened; logging out.');
      this.logout();
    }
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
      // Activity in a sibling tab counts as activity for the whole session; see the class
      // comment on why a per-tab idle timer logged people out of the tab they were using.
      window.addEventListener('storage', this.onStorage);
    });
    this.resetTimer();
    return wasAlreadyIdle;
  }

  ngOnDestroy(): void {
    InactivityService.ACTIVITY_EVENTS.forEach(event =>
      document.removeEventListener(event, this.onActivity)
    );
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('storage', this.onStorage);
    this.clearTimer();
  }

  private resetTimer(): void {
    // Once the warning countdown is showing, ignore background activity: the
    // user must explicitly choose to stay logged in.
    if (this.warningDialogRef)
      return;
    this.lastActivityAt = Date.now();
    this.publishActivity();
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
    // Routed through TokenRefreshService so this keep-alive queues behind, rather than races,
    // a refresh already running in this or any other tab - refresh tokens are single-use and
    // the cookie holding them is shared by every tab.
    this.tokenRefreshService.refresh().subscribe({
      next: (token: string) => {
        const at = new Date().toISOString();
        if (token) {
          console.debug(`[InactivityService] proactive keep-alive refresh succeeded at ${at}`);
        } else {
          console.debug(`[InactivityService] proactive keep-alive refresh returned no token at ${at}`);
        }
      },
      error: (error: unknown) => console.debug(
        `[InactivityService] proactive keep-alive refresh failed at ${new Date().toISOString()}; leaving it to the reactive refresh/idle logout.`, error)
    });
  }

  /**
   * Publish this tab's activity for its siblings, throttled - see
   * {@link ACTIVITY_PUBLISH_INTERVAL_MS}.
   */
  private publishActivity(): void {
    const now = Date.now();
    if (now - this.lastActivityPublishedAt < InactivityService.ACTIVITY_PUBLISH_INTERVAL_MS)
      return;
    this.lastActivityPublishedAt = now;
    localStorage.setItem(InactivityService.LAST_ACTIVITY_KEY, String(now));
  }

  /**
   * The most recent user activity anywhere in this session: this tab's own, or whatever a
   * sibling tab last published. Values in the future are ignored so a clock change cannot push
   * the idle deadline out indefinitely.
   */
  private lastSessionActivityAt(): number {
    const published = Number(localStorage.getItem(InactivityService.LAST_ACTIVITY_KEY));
    const now = Date.now();
    if (!Number.isFinite(published) || published <= 0 || published > now)
      return this.lastActivityAt;
    return Math.max(this.lastActivityAt, published);
  }

  /** How long the whole session (not just this tab) has been idle, in milliseconds. */
  private sessionIdleMs(): number {
    return Date.now() - this.lastSessionActivityAt();
  }

  /**
   * Whether the persisted last-activity timestamp already shows the session idle for at
   * least the full timeout, judged purely against wall-clock time.
   *
   * Deliberately not lastSessionActivityAt()/sessionIdleMs(): those floor against
   * this.lastActivityAt, which is set to "now" the instant this service is constructed, so
   * a live tab's own recent activity is never masked by a stale sibling-tab timestamp. That
   * floor is exactly wrong for a cold start - there has been no activity yet in this tab, so
   * it would treat "the app just loaded" as proof the session is fresh, defeating the very
   * check this method exists for.
   */
  private isAlreadyIdlePastTimeout(): boolean {
    const published = Number(localStorage.getItem(InactivityService.LAST_ACTIVITY_KEY));
    const now = Date.now();
    if (!Number.isFinite(published) || published <= 0 || published > now)
      return false; // Nothing recorded yet, or a clock-skewed value - nothing to judge against.
    return now - published >= InactivityService.INACTIVITY_TIMEOUT_MS;
  }

  /**
   * A sibling tab reported activity. If our warning countdown is showing, the curator is alive
   * and working in another tab - dismiss it rather than letting it run down and log every tab
   * out. resetTimer() ignores activity while the dialog is up (staying logged in has to be a
   * deliberate choice), so closing it with 'stay' is what restarts the clock here.
   */
  private handleSiblingActivity(event: StorageEvent): void {
    if (event.key !== InactivityService.LAST_ACTIVITY_KEY || !event.newValue)
      return;
    if (!this.warningDialogRef)
      return;
    console.debug('[InactivityService] activity in another tab while the inactivity warning was showing; keeping the session.');
    // Dialogs must be closed inside Angular's zone; storage events arrive outside it.
    this.zone.run(() => this.warningDialogRef?.close('stay'));
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
    const idleMs = this.sessionIdleMs();
    if (idleMs >= InactivityService.INACTIVITY_TIMEOUT_MS) {
      this.zone.run(() => this.logout());
      return;
    }
    // The session has seen activity more recently than this tab has - the curator is working in
    // another tab. Say nothing (a warning here is invisible behind the window they are using)
    // and come back when the session as a whole would be due.
    const warnAtIdleMs = InactivityService.INACTIVITY_TIMEOUT_MS
      - InactivityService.WARNING_COUNTDOWN_SECONDS * 1000;
    if (idleMs < warnAtIdleMs) {
      this.clearTimer();
      this.timerId = setTimeout(() => this.onIdle(), warnAtIdleMs - idleMs);
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
    if (this.sessionIdleMs() >= InactivityService.INACTIVITY_TIMEOUT_MS)
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
    // Remember the view this tab is showing before it is replaced by the login page. An idle
    // logout is not something the curator chose, so logging back in should return them to what
    // they were reading - and with several tabs open, each on a different view, every one of
    // them has to remember its own. Saved before persistInstances() rather than in its
    // callback: that call clears the token, and once it is gone a sibling tab can navigate
    // this one to /login (SessionSyncService) before the callback ever runs, leaving nothing
    // here worth recording. A logout the curator asked for saves nothing, by contrast - there
    // is no interrupted view to come back to.
    saveReturnUrl();
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
