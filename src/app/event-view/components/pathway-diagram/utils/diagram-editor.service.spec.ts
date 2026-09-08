import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { DataService } from 'src/app/core/services/data.service';
import { DiagramLock } from 'src/app/core/models/reactome-instance.model';

import { DiagramEditorService } from './diagram-editor.service';

describe('DiagramEditorService lock cache ownership', () => {
  const getDiagramLocksUrl = `${environment.ApiRoot}/getDiagramLocks/`;

  // Two tokens for curator-a so a token refresh can be told apart from a change of user.
  const tokenUsers: { [token: string]: string } = {
    'token-a1': 'curator-a',
    'token-a2': 'curator-a',
    'token-b1': 'curator-b'
  };

  let service: DiagramEditorService;
  let httpMock: HttpTestingController;

  const lockOf = (diagramDbId: number, username: string): DiagramLock => ({
    diagramDbId,
    lockId: `lock-${diagramDbId}`,
    lockedAt: '2026-09-08 12:00:00',
    username
  } as DiagramLock);

  /** Sign in the only way the service can see it: a token in localStorage. */
  const signInWith = (token: string) => localStorage.setItem('token', token);
  const signOut = () => localStorage.removeItem('token');

  /** Populate the cache for the given token's user from the server. */
  const loadLocksFor = async (token: string, locks: DiagramLock[]) => {
    signInWith(token);
    const pending = firstValueFrom(service.getDiagramLocks());
    httpMock.expectOne(getDiagramLocksUrl).flush(locks);
    return pending;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DiagramEditorService,
        // Only the two hooks the lock code reaches for; the real DataService would drag in the
        // whole schema bootstrap.
        { provide: DataService, useValue: { handleErrorMessage: (_error: Error) => of(null), fetchInstance: () => of({}) } },
        // Stands in for AuthenticateService.getUser(), which decodes the username out of the token.
        { provide: AuthenticateService, useValue: { getUser: () => tokenUsers[localStorage.getItem('token') || ''] } }
      ]
    });
    service = TestBed.inject(DiagramEditorService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.removeItem('diagramLocks');
    signOut();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('diagramLocks');
    signOut();
  });

  it('serves the same user from cache rather than re-asking the server', async () => {
    const locks = await loadLocksFor('token-a1', [lockOf(111, 'curator-a')]);
    expect(locks.length).toBe(1);

    const again = await firstValueFrom(service.getDiagramLocks());
    expect(again.length).toBe(1);
    httpMock.expectNone(getDiagramLocksUrl);
  });

  it('does not hand a new user the previous user\'s locks', async () => {
    await loadLocksFor('token-a1', [lockOf(111, 'curator-a')]);
    expect(service.isDiagramLockedByMe(111)).toBeTrue();

    // Log out and log in as somebody else. The service instance survives both: logging out only
    // navigates to /login, it never tears this cache down.
    signOut();
    signInWith('token-b1');

    expect(service.isDiagramLockedByMe(111)).toBeFalse();
    expect(service.getCachedDiagramLock(111)).toBeNull();

    const afterSwitch = firstValueFrom(service.getDiagramLocks());
    httpMock.expectOne(getDiagramLocksUrl).flush([lockOf(222, 'curator-b')]);
    expect(await afterSwitch).toEqual([lockOf(222, 'curator-b')]);
    expect(service.isDiagramLockedByMe(111)).toBeFalse();
    expect(service.isDiagramLockedByMe(222)).toBeTrue();
  });

  it('refetches for a new user even when the first fetch was never resubscribed', async () => {
    await loadLocksFor('token-a1', [lockOf(111, 'curator-a')]);

    signInWith('token-b1');

    // The in-flight/replayed observable was issued for curator-a and must not be reused here.
    const afterSwitch = firstValueFrom(service.getDiagramLocks());
    httpMock.expectOne(getDiagramLocksUrl).flush([]);
    expect(await afterSwitch).toEqual([]);
  });

  it('drops the cached locks on logout, so nothing survives into the next session', async () => {
    await loadLocksFor('token-a1', [lockOf(111, 'curator-a')]);

    signOut();

    expect(service.getCachedDiagramLock(111)).toBeNull();
    expect(localStorage.getItem('diagramLocks')).toBe('[]');
  });

  it('keeps the cache across a token refresh, which is the same user with a new token', async () => {
    await loadLocksFor('token-a1', [lockOf(111, 'curator-a')]);

    // TokenRefreshService swaps in a fresh token periodically; the user has not changed.
    signInWith('token-a2');

    expect(service.isDiagramLockedByMe(111)).toBeTrue();
    httpMock.expectNone(getDiagramLocksUrl);
  });
});
