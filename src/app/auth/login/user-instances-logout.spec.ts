import { of } from 'rxjs';
import { NEXT_NEW_DB_ID_STORAGE_KEY } from 'src/app/core/services/data.service';
import { UserInstancesService } from './user-instances.service';

/**
 * A tab that is not reloaded keeps its caches through a logout and a fresh login, so the new-dbId counter must
 * survive the logout's localStorage.clear(): starting again at -1 handed a new instance the dbId of a discarded one
 * still cached in that tab (see DataService.getNextNewDbId).
 */
describe('UserInstancesService logout', () => {
  afterEach(() => localStorage.clear());

  it('keeps the new-dbId counter, and still clears the session', () => {
    localStorage.setItem(NEXT_NEW_DB_ID_STORAGE_KEY, '-13');
    localStorage.setItem('token', 't');
    localStorage.setItem('login_username', 'curator1');
    localStorage.setItem('someOtherKey', 'x');
    const store = jasmine.createSpyObj('Store', ['select', 'dispatch']);
    store.select.and.returnValue(of([]));
    const dataService = jasmine.createSpyObj('DataService', ['deletePersistedInstances']);
    dataService.deletePersistedInstances.and.returnValue(of({}));
    const auth = jasmine.createSpyObj('AuthenticateService', ['getUser', 'logout']);
    auth.getUser.and.returnValue('curator1');
    auth.logout.and.returnValue(of({}));
    spyOn(window, 'addEventListener');      // the constructor's storage listener must not leak into other specs
    const service = new UserInstancesService({} as any, dataService, auth, store);

    let loggedOut: boolean | undefined;
    service.persistInstances(true, r => loggedOut = r);

    expect(loggedOut).toBeTrue();
    expect(localStorage.getItem(NEXT_NEW_DB_ID_STORAGE_KEY)).toBe('-13');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('login_username')).toBeNull();
    expect(localStorage.getItem('someOtherKey')).toBeNull();
  });
});
