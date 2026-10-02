import { of, throwError } from 'rxjs';
import { Instance, UserInstances } from 'src/app/core/models/reactome-instance.model';
import { UserInstancesService } from './user-instances.service';

describe('UserInstancesService.loadAnnotationInstances', () => {
  const inst = (dbId: number): Instance => ({ dbId, schemaClassName: 'Reaction', displayName: `r${dbId}` });
  const staged = (n: number, extra: Partial<UserInstances> = {}): UserInstances =>
    ({ newInstances: Array.from({ length: n }, (_, i) => inst(-(i + 1))), updatedInstances: [], deletedInstances: [], bookmarks: [], ...extra });
  const incoming = staged(3);

  let service: UserInstancesService;
  let dataService: jasmine.SpyObj<any>;
  let auth: jasmine.SpyObj<any>;
  let importSpy: jasmine.Spy;
  let order: string[];

  const make = (current: UserInstances) => {
    order = [];
    dataService = jasmine.createSpyObj('DataService', ['persitUserInstances', 'listUserInstanceBackups']);
    dataService.persitUserInstances.and.callFake(() => { order.push('persist'); return of({}); });
    dataService.listUserInstanceBackups.and.returnValue(of([
      { fileName: 'old.json', lastModified: 100 }, { fileName: 'newest.json', lastModified: 300 }, { fileName: 'mid.json', lastModified: 200 }]));
    auth = jasmine.createSpyObj('AuthenticateService', ['getUser']);
    auth.getUser.and.returnValue('curator1');
    // The constructor registers a permanent window 'storage' listener; keep this instance from leaking one
    // into every later spec (a storage event fired elsewhere would call it with these spies).
    spyOn(window, 'addEventListener');
    service = new UserInstancesService({} as any, dataService, auth, {} as any);
    spyOn<any>(service, 'currentStaged').and.returnValue(of(current));
    importSpy = spyOn(service, 'importUserInstancesFromFile').and.callFake(() => { order.push('import'); return of(incoming); });
  };

  afterEach(() => localStorage.clear());

  it('loads straight away, with no backup, when nothing is staged', async () => {
    make(staged(0));
    const r = await service.loadAnnotationInstances(incoming).toPromise();
    expect(dataService.persitUserInstances).not.toHaveBeenCalled();
    expect(importSpy).toHaveBeenCalledWith(incoming);
    expect(r).toEqual({ replaced: 0, backedUp: false, loaded: 3 });
  });

  it('backs up what is staged first, then replaces it, and reports the newest backup', async () => {
    make(staged(5, { updatedInstances: [inst(7)], bookmarks: [inst(9)] }));
    const r = await service.loadAnnotationInstances(incoming).toPromise();
    expect(order).toEqual(['persist', 'import']);                       // the backup completes before anything is replaced
    expect(dataService.persitUserInstances.calls.mostRecent().args[1]).toBe('curator1');
    expect(dataService.persitUserInstances.calls.mostRecent().args[0].newInstances.length).toBe(5);
    expect(r).toEqual({ replaced: 7, backedUp: true, backupFile: 'newest.json', loaded: 3 });
  });

  it('counts a lone bookmark or default person as staged work worth backing up', async () => {
    make(staged(0, { defaultPerson: inst(1) }));
    await service.loadAnnotationInstances(incoming).toPromise();
    expect(dataService.persitUserInstances).toHaveBeenCalled();
  });

  it('replaces nothing when the backup fails', async () => {
    make(staged(2));
    dataService.persitUserInstances.and.returnValue(throwError(() => new Error('server down')));
    await expectAsync(service.loadAnnotationInstances(incoming).toPromise()).toBeRejectedWithError('server down');
    expect(importSpy).not.toHaveBeenCalled();
  });

  it('replaces nothing when nobody is signed in to take the backup', async () => {
    make(staged(2));
    auth.getUser.and.returnValue(undefined);
    await expectAsync(service.loadAnnotationInstances(incoming).toPromise()).toBeRejectedWithError(/not signed in/);
    expect(importSpy).not.toHaveBeenCalled();
    expect(dataService.persitUserInstances).not.toHaveBeenCalled();
  });

  it('still loads when only the backup file name cannot be looked up', async () => {
    make(staged(2));
    dataService.listUserInstanceBackups.and.returnValue(throwError(() => new Error('nope')));
    const r = await service.loadAnnotationInstances(incoming).toPromise();
    expect(r).toEqual({ replaced: 2, backedUp: true, backupFile: undefined, loaded: 3 });
    expect(importSpy).toHaveBeenCalled();
  });

  it('does not load when the load itself fails, and the backup is still there', async () => {
    make(staged(2));
    importSpy.and.returnValue(throwError(() => new Error('bad schema')));
    await expectAsync(service.loadAnnotationInstances(incoming).toPromise()).toBeRejectedWithError('bad schema');
    expect(dataService.persitUserInstances).toHaveBeenCalledTimes(1);
  });
});
