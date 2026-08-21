import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { InactivityWarningResult } from 'src/app/shared/components/inactivity-warning-dialog/inactivity-warning-dialog.component';

import { InactivityService } from './inactivity.service';
import { TokenRefreshService } from './token-refresh.service';

describe('InactivityService', () => {
  const MINUTE = 60 * 1000;
  const ACTIVITY_KEY = 'last_activity_at';

  let service: InactivityService;
  let dialog: jasmine.SpyObj<MatDialog>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;
  let afterClosed: Subject<InactivityWarningResult>;
  let dialogRef: { close: jasmine.Spy, afterClosed: () => Subject<InactivityWarningResult> };

  /** What a sibling tab publishing user activity looks like from in here. */
  const siblingActivity = () => {
    const at = String(Date.now());
    localStorage.setItem(ACTIVITY_KEY, at);
    window.dispatchEvent(new StorageEvent('storage', { key: ACTIVITY_KEY, newValue: at }));
  };

  beforeEach(() => {
    afterClosed = new Subject<InactivityWarningResult>();
    dialogRef = { close: jasmine.createSpy('close'), afterClosed: () => afterClosed };
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue(dialogRef as unknown as MatDialogRef<any, any>);
    userInstances = jasmine.createSpyObj<UserInstancesService>('UserInstancesService', ['persistInstances']);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: MatDialog, useValue: dialog },
        { provide: UserInstancesService, useValue: userInstances },
        { provide: TokenRefreshService, useValue: { refresh: () => of('token'), isTokenValid: () => true } }
      ]
    });
    service = TestBed.inject(InactivityService);
    localStorage.setItem('token', 'a-token');
    localStorage.removeItem(ACTIVITY_KEY);
    sessionStorage.removeItem('currentUrl');
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.removeItem('token');
    localStorage.removeItem(ACTIVITY_KEY);
    sessionStorage.removeItem('currentUrl');
  });

  it('warns and then logs out once every tab has gone quiet', fakeAsync(() => {
    service.start();

    tick(17 * MINUTE);
    expect(dialog.open).toHaveBeenCalled();

    afterClosed.next('logout');
    expect(userInstances.persistInstances).toHaveBeenCalledWith(true, jasmine.any(Function));
  }));

  // The bug this covers: an idle logout replaced the tab's view with the login page without
  // recording what that view was, so several tabs left to time out overnight - each on a
  // different instance - all came back on /home with their links lost. Every other teardown
  // path (the route guard, the interceptor, a sibling tab's logout) already saved it.
  it('remembers the view it was showing so logging back in returns there', fakeAsync(() => {
    service.start();

    tick(17 * MINUTE);
    afterClosed.next('logout');

    expect(sessionStorage.getItem('currentUrl')).toBeTruthy();
  }));

  it('says nothing while the curator is working in another tab', fakeAsync(() => {
    // The warning would be invisible behind the window actually in use, and its countdown would
    // clear the shared token - logging the curator out of the tab they are typing in.
    service.start();

    tick(10 * MINUTE);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    tick(8 * MINUTE);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(userInstances.persistInstances).not.toHaveBeenCalled();

    // ...and it still times out on its own schedule once that tab goes quiet too.
    tick(10 * MINUTE);
    expect(dialog.open).toHaveBeenCalled();
  }));

  it('keeps the session when a sibling tab reports activity during the countdown', fakeAsync(() => {
    service.start();
    tick(17 * MINUTE);
    expect(dialog.open).toHaveBeenCalled();

    siblingActivity();

    expect(dialogRef.close).toHaveBeenCalledWith('stay');
    expect(userInstances.persistInstances).not.toHaveBeenCalled();
  }));

  it('publishes this tab\'s activity for its siblings to see', fakeAsync(() => {
    service.start();

    expect(Number(localStorage.getItem(ACTIVITY_KEY))).toBeGreaterThan(0);

    const publishedAtStart = localStorage.getItem(ACTIVITY_KEY);
    tick(6 * MINUTE);
    document.dispatchEvent(new MouseEvent('mousedown'));
    expect(localStorage.getItem(ACTIVITY_KEY)).not.toBe(publishedAtStart);

    tick(20 * MINUTE);
  }));

  it('ignores an activity timestamp from the future', fakeAsync(() => {
    // A clock skewed forwards (or a stale value from another machine, via a synced profile) must
    // not be able to postpone the idle timeout indefinitely.
    service.start();
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() + 24 * 60 * MINUTE));

    tick(17 * MINUTE);

    expect(dialog.open).toHaveBeenCalled();
  }));

  it('logs out immediately if the session was already idle past the timeout before this tab opened', fakeAsync(() => {
    // Nothing was open to run the idle timer while every tab was closed, so the only sign
    // this session is already stale is the last-activity timestamp left behind.
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 19 * MINUTE));

    // The return value lets callers (AppComponent) skip firing an authenticated request - e.g.
    // loading the user's staged instances - with a token that's about to be invalidated.
    expect(service.start()).toBeTrue();

    expect(userInstances.persistInstances).toHaveBeenCalledWith(true, jasmine.any(Function));
    // The immediate logout doesn't stop start() from also scheduling the normal idle timer
    // (harmless once logged out); retire it before fakeAsync checks the queue.
    service.ngOnDestroy();
  }));

  it('does not log out on start when the last recorded activity is still within the timeout', fakeAsync(() => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 5 * MINUTE));

    expect(service.start()).toBeFalse();

    expect(userInstances.persistInstances).not.toHaveBeenCalled();
    service.ngOnDestroy();
  }));

  it('does nothing at all when nobody is logged in', fakeAsync(() => {
    localStorage.removeItem('token');
    service.start();

    tick(20 * MINUTE);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(userInstances.persistInstances).not.toHaveBeenCalled();
    // The timer simply restarts while logged out, so retire it before fakeAsync checks the queue.
    service.ngOnDestroy();
  }));
});
