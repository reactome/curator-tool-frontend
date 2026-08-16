import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { SessionSyncService } from './session-sync.service';

describe('SessionSyncService', () => {
  let service: SessionSyncService;
  let router: { url: string, navigate: jasmine.Spy };
  let dialog: jasmine.SpyObj<MatDialog>;
  let reloadTo: jasmine.Spy;

  /** Fire the storage event a *sibling* tab's localStorage write would produce here. */
  const fireStorage = (key: string | null, newValue: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

  beforeEach(() => {
    router = {
      url: '/schema_view/instance/123',
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true))
    };
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['closeAll', 'open']);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: dialog }
      ]
    });
    service = TestBed.inject(SessionSyncService);
    // A real assignment to window.location.href would navigate this test runner away.
    reloadTo = spyOn(service as any, 'reloadTo');
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUrl');
    service.start();
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUrl');
  });

  it('logs this tab out when another tab removes the token', () => {
    fireStorage('token', null);

    expect(dialog.closeAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(sessionStorage.getItem('currentUrl')).toBeTruthy();
  });

  it('logs this tab out when another tab clears localStorage wholesale', () => {
    fireStorage(null, null);

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('ignores a sibling tab writing a new token when this tab is not at /login', () => {
    localStorage.setItem('token', 'fresh-token');

    fireStorage('token', 'fresh-token');

    expect(router.navigate).not.toHaveBeenCalled();
    expect(reloadTo).not.toHaveBeenCalled();
  });

  it('reloads to the stashed URL when a sibling logs back in while this tab is at /login', () => {
    router.url = '/login';
    sessionStorage.setItem('currentUrl', '/schema_view/instance/456');
    localStorage.setItem('token', 'fresh-token');

    fireStorage('token', 'fresh-token');

    expect(reloadTo).toHaveBeenCalledWith('/schema_view/instance/456');
    // The stashed URL is one-shot, same as the normal post-login read in login.component.ts.
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });

  it('reloads to /home when a sibling logs back in while this tab is at /login with nothing stashed', () => {
    router.url = '/login';
    localStorage.setItem('token', 'fresh-token');

    fireStorage('token', 'fresh-token');

    expect(reloadTo).toHaveBeenCalledWith('/home');
  });

  it('ignores unrelated localStorage keys', () => {
    fireStorage('syncUserInstances', '{}');

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not tear down a tab whose token is still present', () => {
    // A logout clears everything and then restores a few preserved keys, so the
    // key === null event can arrive while a token is legitimately in place.
    localStorage.setItem('token', 'still-here');

    fireStorage(null, null);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does nothing when this tab is already on the login page', () => {
    router.url = '/login';

    fireStorage('token', null);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('stops listening once destroyed', () => {
    service.ngOnDestroy();

    fireStorage('token', null);

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
