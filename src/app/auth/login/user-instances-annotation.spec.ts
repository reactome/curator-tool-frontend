import { of, throwError } from 'rxjs';
import { Instance, UserInstances } from 'src/app/core/models/reactome-instance.model';
import { DefaultPersonActions } from 'src/app/instance/state/instance.actions';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import { UserInstancesService } from './user-instances.service';

describe('UserInstancesService annotation loading', () => {
  const inst = (dbId: number): Instance => ({ dbId, schemaClassName: 'Reaction', displayName: `r${dbId}` });
  const person = (dbId: number): Instance => ({ dbId, schemaClassName: 'Person', displayName: `Person ${dbId}` });
  const bookmark = (dbId: number): Instance => ({ dbId, schemaClassName: 'Pathway', displayName: `Pathway ${dbId}` });
  const staged = (n: number, extra: Partial<UserInstances> = {}): UserInstances =>
    ({ newInstances: Array.from({ length: n }, (_, i) => inst(-(i + 1))), updatedInstances: [], deletedInstances: [], bookmarks: [], ...extra });
  const incoming = staged(3);
  const none = { keptDefaultPerson: false, keptBookmarks: 0 };

  let service: UserInstancesService;
  let dataService: jasmine.SpyObj<any>;
  let auth: jasmine.SpyObj<any>;
  let importSpy: jasmine.Spy;
  let order: string[];
  const loadedPayload = () => importSpy.calls.mostRecent().args[0] as UserInstances;

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

  describe('loadAnnotationInstances', () => {
    it('loads straight away, with no backup, when nothing is staged', async () => {
      make(staged(0));
      const r = await service.loadAnnotationInstances(incoming).toPromise();
      expect(dataService.persitUserInstances).not.toHaveBeenCalled();
      expect(importSpy).toHaveBeenCalledWith(incoming);
      expect(r).toEqual({ replaced: 0, backedUp: false, ...none, loaded: 3 });
    });

    it('backs up what is staged first, then replaces it, and reports the newest backup', async () => {
      make(staged(5, { updatedInstances: [inst(7)], deletedInstances: [inst(9)] }));
      const r = await service.loadAnnotationInstances(incoming).toPromise();
      expect(order).toEqual(['persist', 'import']);                       // the backup completes before anything is replaced
      expect(dataService.persitUserInstances.calls.mostRecent().args[1]).toBe('curator1');
      expect(dataService.persitUserInstances.calls.mostRecent().args[0].newInstances.length).toBe(5);
      expect(r).toEqual({ replaced: 7, backedUp: true, backupFile: 'newest.json', ...none, loaded: 3 });
    });

    it('a lone updated instance is work worth backing up', async () => {
      make(staged(0, { updatedInstances: [inst(1)] }));
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
      expect(r).toEqual({ replaced: 2, backedUp: true, backupFile: undefined, ...none, loaded: 3 });
      expect(importSpy).toHaveBeenCalled();
    });

    it('does not load when the load itself fails, and the backup is still there', async () => {
      make(staged(2));
      importSpy.and.returnValue(throwError(() => new Error('bad schema')));
      await expectAsync(service.loadAnnotationInstances(incoming).toPromise()).toBeRejectedWithError('bad schema');
      expect(dataService.persitUserInstances).toHaveBeenCalledTimes(1);
    });

    describe('the default person', () => {
      it('is kept: the load carries the staged default person, and the annotation itself is not modified', async () => {
        make(staged(5, { defaultPerson: person(77) }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(loadedPayload().defaultPerson).toEqual(person(77));
        expect(loadedPayload().newInstances).toBe(incoming.newInstances);     // everything else is the annotation's
        expect(incoming.defaultPerson).toBeUndefined();                       // the caller's object is untouched
        expect(r!.keptDefaultPerson).toBeTrue();
      });

      it('is not counted as replaced, but is still part of the backup', async () => {
        make(staged(5, { defaultPerson: person(77) }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(r!.replaced).toBe(5);                                          // not 6
        expect(dataService.persitUserInstances.calls.mostRecent().args[0].defaultPerson).toEqual(person(77));
      });

      it('on its own needs no backup (nothing is lost) and is still kept', async () => {
        make(staged(0, { defaultPerson: person(77) }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(dataService.persitUserInstances).not.toHaveBeenCalled();
        expect(loadedPayload().defaultPerson).toEqual(person(77));
        expect(r).toEqual({ replaced: 0, backedUp: false, keptDefaultPerson: true, keptBookmarks: 0, loaded: 3 });
      });

      it('yields to one the incoming data names itself, which then counts as replaced', async () => {
        make(staged(2, { defaultPerson: person(77) }));
        const own = staged(3, { defaultPerson: person(88) });
        const r = await service.loadAnnotationInstances(own).toPromise();
        expect(importSpy).toHaveBeenCalledWith(own);
        expect(r).toEqual({ replaced: 3, backedUp: true, backupFile: 'newest.json', ...none, loaded: 3 });
      });

      it('when none is staged, nothing is invented', async () => {
        make(staged(2));
        await service.loadAnnotationInstances(incoming).toPromise();
        expect(importSpy).toHaveBeenCalledWith(incoming);
        expect(loadedPayload().defaultPerson).toBeUndefined();
      });
    });

    describe('the bookmarks', () => {
      it('are kept: the load carries the staged bookmarks, and the annotation itself is not modified', async () => {
        make(staged(5, { bookmarks: [bookmark(1), bookmark(2)] }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(loadedPayload().bookmarks).toEqual([bookmark(1), bookmark(2)]);
        expect(loadedPayload().newInstances).toBe(incoming.newInstances);
        expect(incoming.bookmarks).toEqual([]);                               // the caller's object is untouched
        expect(r!.keptBookmarks).toBe(2);
      });

      it('are not counted as replaced, but are still part of the backup', async () => {
        make(staged(5, { bookmarks: [bookmark(1), bookmark(2)] }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(r!.replaced).toBe(5);                                          // not 7
        expect(dataService.persitUserInstances.calls.mostRecent().args[0].bookmarks).toEqual([bookmark(1), bookmark(2)]);
      });

      it('on their own need no backup (nothing is lost) and are still kept', async () => {
        make(staged(0, { bookmarks: [bookmark(1)] }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(dataService.persitUserInstances).not.toHaveBeenCalled();
        expect(loadedPayload().bookmarks).toEqual([bookmark(1)]);
        expect(r).toEqual({ replaced: 0, backedUp: false, keptDefaultPerson: false, keptBookmarks: 1, loaded: 3 });
      });

      it('yield to a non-empty list the incoming data brings itself, and the staged ones then count as replaced', async () => {
        make(staged(2, { bookmarks: [bookmark(1)] }));
        const own = staged(3, { bookmarks: [bookmark(9)] });
        const r = await service.loadAnnotationInstances(own).toPromise();
        expect(importSpy).toHaveBeenCalledWith(own);
        expect(r).toEqual({ replaced: 3, backedUp: true, backupFile: 'newest.json', ...none, loaded: 3 });
      });

      it('are kept together with the default person', async () => {
        make(staged(4, { bookmarks: [bookmark(1), bookmark(2), bookmark(3)], defaultPerson: person(77) }));
        const r = await service.loadAnnotationInstances(incoming).toPromise();
        expect(loadedPayload().bookmarks.length).toBe(3);
        expect(loadedPayload().defaultPerson).toEqual(person(77));
        expect(r).toEqual({ replaced: 4, backedUp: true, backupFile: 'newest.json', keptDefaultPerson: true, keptBookmarks: 3, loaded: 3 });
      });

      it('with none staged, the annotation goes through untouched', async () => {
        make(staged(2));
        await service.loadAnnotationInstances(incoming).toPromise();
        expect(importSpy).toHaveBeenCalledWith(incoming);
      });
    });
  });

  describe('stagedSummary', () => {
    it('reports what would be replaced, and what is kept', async () => {
      make(staged(5, { bookmarks: [bookmark(1), bookmark(2)], defaultPerson: person(77) }));
      expect(await service.stagedSummary(incoming).toPromise()).toEqual({ replaced: 5, keepsDefaultPerson: true, keepsBookmarks: 2 });
    });

    it('counts them as replaced when the incoming data brings its own', async () => {
      make(staged(5, { bookmarks: [bookmark(1)], defaultPerson: person(77) }));
      const own = staged(1, { defaultPerson: person(88), bookmarks: [bookmark(9)] });
      expect(await service.stagedSummary(own).toPromise()).toEqual({ replaced: 7, keepsDefaultPerson: false, keepsBookmarks: 0 });
    });

    it('is zero and keeps nothing when nothing is staged', async () => {
      make(staged(0));
      expect(await service.stagedSummary(incoming).toPromise()).toEqual({ replaced: 0, keepsDefaultPerson: false, keepsBookmarks: 0 });
    });
  });

  describe('through the real import path (what reaches the store)', () => {
    /** Runs the real importUserInstancesFromFile, so the actions the store gets can be checked. */
    const realImport = (current: UserInstances) => {
      const dispatched: any[] = [];
      const ds = jasmine.createSpyObj('DataService', ['persitUserInstances', 'listUserInstanceBackups', 'hydrateUserInstances',
        'computePersistPayload', 'resetNextNewDbId', 'fetchBookmarkShell']);
      ds.persitUserInstances.and.returnValue(of({}));
      ds.listUserInstanceBackups.and.returnValue(of([]));
      ds.hydrateUserInstances.and.callFake((u: UserInstances) => of(u));
      ds.computePersistPayload.and.returnValue('{}');
      ds.fetchBookmarkShell.and.callFake((dbId: number) => of(bookmark(dbId)));          // bookmarks still exist: nothing pruned
      const a = jasmine.createSpyObj('AuthenticateService', ['getUser']);
      a.getUser.and.returnValue('curator1');
      spyOn(window, 'addEventListener');
      const svc = new UserInstancesService({ makeShell: (i: Instance) => i } as any, ds, a, { dispatch: (x: any) => dispatched.push(x) } as any);
      spyOn<any>(svc, 'currentStaged').and.returnValue(of(current));
      return { svc, dispatched };
    };
    const ofType = (d: any[], type: string) => d.filter(x => x.type === type);

    it('sets the store\'s default person to the one that was staged, not to nothing', async () => {
      const { svc, dispatched } = realImport(staged(2, { defaultPerson: person(77) }));
      await svc.loadAnnotationInstances(incoming).toPromise();
      const actions = ofType(dispatched, DefaultPersonActions.set_default_person.type);
      expect(actions.length).toBe(1);
      expect(actions[0].dbId).toBe(77);
    });

    it('sets the store\'s bookmarks to the ones that were staged, not to an empty list', async () => {
      const { svc, dispatched } = realImport(staged(2, { bookmarks: [bookmark(1), bookmark(2)] }));
      await svc.loadAnnotationInstances(incoming).toPromise();
      const actions = ofType(dispatched, BookmarkActions.set_bookmarks.type);
      expect(actions.length).toBe(1);
      expect(actions[0].instances.map((b: Instance) => b.dbId)).toEqual([1, 2]);
    });

    it('with no default person or bookmarks staged, the store is told there are none', async () => {
      const { svc, dispatched } = realImport(staged(2));
      await svc.loadAnnotationInstances(incoming).toPromise();
      expect(ofType(dispatched, DefaultPersonActions.set_default_person.type)[0].dbId).toBeUndefined();
      expect(ofType(dispatched, BookmarkActions.set_bookmarks.type)[0].instances).toEqual([]);
    });
  });
});
