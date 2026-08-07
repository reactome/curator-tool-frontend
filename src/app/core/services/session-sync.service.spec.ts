import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { SessionSyncService } from './session-sync.service';

describe('SessionSyncService', () => {
  let service: SessionSyncService;
  let router: { url: string, navigate: jasmine.Spy };
  let dialog: jasmine.SpyObj<MatDialog>;

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

  it('ignores a sibling tab writing a new token (a login, not a logout)', () => {
    localStorage.setItem('token', 'fresh-token');

    fireStorage('token', 'fresh-token');

    expect(router.navigate).not.toHaveBeenCalled();
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
