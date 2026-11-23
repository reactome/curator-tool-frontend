import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { firstValueFrom, of } from 'rxjs';

import { Instance } from '../models/reactome-instance.model';
import { AttributeCategory, SchemaClass } from '../models/reactome-schema.model';
import { UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  InstanceUtilitiesSpy,
  StoreSpy,
  createDataServiceSpy,
  createInstanceUtilitiesSpy,
  makeAttribute,
  makeInstance,
  makeInstanceAttribute,
  makeSchemaClass,
  makeShellInstance,
  provideStoreSpy
} from 'src/testing';
import { DataService } from './data.service';
import {
  DatabaseMergeError,
  DatabaseMergeRow,
  DatabaseMergeService,
  isInstanceChangedError
} from './database-merge.service';
import { InstanceUtilities } from './instance.service';

describe('DatabaseMergeService', () => {
  let service: DatabaseMergeService;
  let dataService: jasmine.SpyObj<DataService>;
  let utils: InstanceUtilitiesSpy;
  let store: StoreSpy;

  const pathwayClass: SchemaClass = makeSchemaClass('Pathway', {
    attributes: [
      makeAttribute('name', { cardinality: '+', category: AttributeCategory.REQUIRED }),
      makeAttribute('definition'),
      makeInstanceAttribute('hasEvent', ['Event']),
      makeInstanceAttribute('modified', ['InstanceEdit'], { cardinality: '1' }),
      makeInstanceAttribute('modifiedList', ['InstanceEdit'], { cardinality: '+' }),
      makeAttribute('stableIdentifier', { category: AttributeCategory.NOMANUALEDIT }),
      makeAttribute('displayName'),
    ]
  });
  const reaction = (dbId: number) => makeShellInstance(dbId, `Reaction ${dbId}`, 'Reaction');
  const edit = (dbId: number) => makeShellInstance(dbId, `Edit ${dbId}`, 'InstanceEdit');

  /** Staged copy: the curator renamed it and added reaction 3; staged against InstanceEdit 50. */
  function staged(): Instance {
    return makeInstance({
      dbId: 100,
      displayName: 'Glycolysis (mine)',
      schemaClass: pathwayClass,
      modifiedAttributes: ['name', 'hasEvent'],
      attributes: {
        name: ['Glycolysis (mine)'],
        definition: 'old definition',
        hasEvent: [reaction(1), reaction(2), reaction(3)],
        modified: edit(50),
      }
    });
  }

  /** Database copy: someone else changed the definition and committed, adding InstanceEdit 60. */
  function database(): Instance {
    return makeInstance({
      dbId: 100,
      displayName: 'Glycolysis',
      attributes: {
        name: ['Glycolysis'],
        definition: 'new definition',
        hasEvent: [reaction(1), reaction(2)],
        modified: edit(60),
      }
    });
  }

  beforeEach(() => {
    dataService = createDataServiceSpy();
    utils = createInstanceUtilitiesSpy();
    utils.makeShell.and.callFake((inst: Instance) =>
      ({ dbId: inst.dbId, displayName: inst.displayName, schemaClassName: inst.schemaClassName }));
    dataService.getSchemaClass.and.returnValue(pathwayClass);
    dataService.handleSchemaClassForInstance.and.callFake((inst: Instance) => of(inst));

    TestBed.configureTestingModule({
      providers: [
        DatabaseMergeService,
        provideStoreSpy(),
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: utils },
      ]
    });
    service = TestBed.inject(DatabaseMergeService);
    store = TestBed.inject(Store) as unknown as StoreSpy;
  });

  const row = (rows: DatabaseMergeRow[], name: string) => rows.find(r => r.attribute.name === name)!;

  describe('building rows', () => {
    it('lists only the attributes that differ, never displayName', () => {
      const rows = service.buildRows(staged(), database());

      expect(rows.map(r => r.attribute.name).sort()).toEqual(['definition', 'hasEvent', 'modified', 'name']);
    });

    it('locks modified to the database value, even when the schema does not say NOMANUALEDIT', () => {
      // The fixture's `modified` is OPTIONAL; keeping the staged one would get a 409 again.
      const modified = row(service.buildRows(staged(), database()), 'modified');

      expect(modified.locked).toBeTrue();
      expect(modified.choice).toEqual('database');
    });

    it('locks a NOMANUALEDIT attribute to the database value, even when the curator\'s copy changed it', () => {
      const local = staged();
      local.attributes.set('stableIdentifier', 'R-HSA-mine');
      local.modifiedAttributes = [...local.modifiedAttributes!, 'stableIdentifier'];
      const db = database();
      db.attributes.set('stableIdentifier', 'R-HSA-theirs');

      const stId = row(service.buildRows(local, db), 'stableIdentifier');

      expect(stId.editedLocally).toBeTrue();
      expect(stId.locked).toBeTrue();
      expect(stId.choice).toEqual('database');
      expect(service.mergedValues(stId)).toEqual(['R-HSA-theirs']);
    });

    it('does not let a locked row be switched to the curator value', () => {
      const rows = service.buildRows(staged(), database());

      service.choose(row(rows, 'modified'), 'local');
      service.choose(row(rows, 'definition'), 'local');

      expect(row(rows, 'modified').choice).toEqual('database');
      expect(row(rows, 'definition').choice).toEqual('local');
    });

    it('takes the database value of a locked row even if its choice was forced to local', () => {
      // merge() goes through mergedValues(), so the lock holds however the choice got there.
      const rows = service.buildRows(staged(), database());
      row(rows, 'modified').choice = 'local';

      const merged = service.merge({ local: staged(), database: database(), rows });

      expect(merged.attributes.get('modified').dbId).toEqual(60);
      expect(merged.modifiedAttributes).not.toContain('modified');
    });

    it('defaults to the curator value where they edited, and to the database value elsewhere', () => {
      const rows = service.buildRows(staged(), database());

      expect(row(rows, 'name').choice).toEqual('local');
      expect(row(rows, 'hasEvent').choice).toEqual('local');
      // The curator never touched definition, so the other committer's change must survive.
      expect(row(rows, 'definition').editedLocally).toBeFalse();
      expect(row(rows, 'definition').choice).toEqual('database');
    });

    it('treats a passively modified attribute as edited by the curator', () => {
      const local = staged();
      local.modifiedAttributes = [];
      local.passiveModifiedAttributes = ['hasEvent'];

      expect(row(service.buildRows(local, database()), 'hasEvent').choice).toEqual('local');
    });

    it('compares lists in order', () => {
      const local = staged();
      local.attributes.set('hasEvent', [reaction(2), reaction(1)]);

      expect(row(service.buildRows(local, database()), 'hasEvent')).toBeDefined();
    });
  });

  describe('merging', () => {
    it('starts from the database copy so the current modified InstanceEdit is committed', () => {
      // Keeping the staged `modified` (50) is exactly what the backend rejects with 409.
      const local = staged();
      const merged = service.merge({ local, database: database(), rows: service.buildRows(local, database()) });

      expect(merged.attributes.get('modified').dbId).toEqual(60);
      expect(merged.attributes.get('definition')).toEqual('new definition');
      expect(merged.attributes.get('name')).toEqual(['Glycolysis (mine)']);
      expect(merged.attributes.get('hasEvent').map((i: Instance) => i.dbId)).toEqual([1, 2, 3]);
    });

    it('flags only the attributes that still differ from the database', () => {
      const local = staged();
      const merged = service.merge({ local, database: database(), rows: service.buildRows(local, database()) });

      expect(merged.modifiedAttributes).toContain('name');
      expect(merged.modifiedAttributes).toContain('hasEvent');
      expect(merged.modifiedAttributes).not.toContain('definition');
    });

    it('stores a single-valued choice as a value, not a list', () => {
      const local = staged();
      const rows = service.buildRows(local, database());
      row(rows, 'definition').choice = 'local';

      const merged = service.merge({ local, database: database(), rows });

      expect(merged.attributes.get('definition')).toEqual('old definition');
    });

    it('removes an attribute when the chosen side is empty', () => {
      const local = staged();
      local.attributes.delete('definition');
      const rows = service.buildRows(local, database());
      row(rows, 'definition').choice = 'local';

      const merged = service.merge({ local, database: database(), rows });

      expect(merged.attributes.has('definition')).toBeFalse();
    });

    it('produces no modified attributes when every row takes the database value', () => {
      const local = staged();
      const rows = service.buildRows(local, database());
      rows.forEach(r => r.choice = 'database');

      const merged = service.merge({ local, database: database(), rows });

      expect(merged.modifiedAttributes).toEqual([]);
      expect(merged.displayName).toEqual('Glycolysis');
    });
  });

  describe('"both" for multivalued attributes', () => {
    it('keeps the database list and appends what the curator added', () => {
      const db = [reaction(1), reaction(4)];
      const mine = [reaction(1), reaction(3)];

      expect(service.unionKeepingMultiplicity(db, mine).map(i => i.dbId)).toEqual([1, 4, 3]);
    });

    it('keeps repeats, because repeats encode stoichiometry', () => {
      // Two copies of ATP as input on the curator's side, one in the database: the merge must
      // not collapse the curator's stoichiometry of 2 back to 1.
      const atp = makeShellInstance(7, 'ATP', 'SimpleEntity');

      expect(service.unionKeepingMultiplicity([atp], [atp, atp]).length).toEqual(2);
      expect(service.unionKeepingMultiplicity([atp, atp], [atp]).length).toEqual(2);
    });
  });

  describe('applying', () => {
    it('replaces the staged copy and broadcasts it as an edit when changes remain', () => {
      const local = staged();
      const outcome = service.apply({ local, database: database(), rows: service.buildRows(local, database()) });

      expect(outcome.stillStaged).toBeTrue();
      expect(dataService.registerInstance).toHaveBeenCalledWith(outcome.instance);
      expect(utils.registerUpdatedInstance).toHaveBeenCalledWith(jasmine.any(String), outcome.instance);
      expect(utils.setRefreshViewDbId).toHaveBeenCalledWith(100);
    });

    it('drops the instance from the updated list when nothing differs any more', () => {
      const local = staged();
      const rows = service.buildRows(local, database());
      rows.forEach(r => r.choice = 'database');

      const outcome = service.apply({ local, database: database(), rows });

      expect(outcome.stillStaged).toBeFalse();
      expect(utils.registerUpdatedInstance).not.toHaveBeenCalled();
      expect(store.dispatchedActions.map(a => a.type))
        .toContain(UpdateInstanceActions.remove_updated_instance.type);
    });
  });

  describe('preparing', () => {
    it('reads the database copy without replacing the staged copy in the cache', async () => {
      dataService.getCachedInstance.and.returnValue(staged());
      dataService.fetchInstanceFromDatabase.and.returnValue(of(database()));

      const data = await firstValueFrom(service.prepare(100));

      expect(dataService.fetchInstanceFromDatabase).toHaveBeenCalledWith(100, false);
      // name, definition, hasEvent, and the locked `modified` row.
      expect(data.rows.length).toEqual(4);
    });

    it('refuses when the staged copy is not loaded in this window', async () => {
      dataService.getCachedInstance.and.returnValue(undefined);

      await expectAsync(firstValueFrom(service.prepare(100))).toBeRejectedWithError(DatabaseMergeError);
    });

    it('refuses when the class differs between the two copies', async () => {
      dataService.getCachedInstance.and.returnValue(staged());
      const db = database();
      db.schemaClassName = 'TopLevelPathway';
      dataService.fetchInstanceFromDatabase.and.returnValue(of(db));

      await expectAsync(firstValueFrom(service.prepare(100))).toBeRejectedWithError(DatabaseMergeError);
    });
  });

  describe('merge requests', () => {
    it('hands a request to the instance view that asks for it, once', () => {
      // The requester navigates to the comparison, which creates a new instance view; that view
      // takes the request when its comparison has loaded.
      service.requestMerge(100, 'commit refused');

      expect(service.takeRequest(100)).toEqual({ dbId: 100, reason: 'commit refused' });
      expect(service.takeRequest(100)).toBeUndefined();
    });

    it('does not hand a request to a view showing another instance', () => {
      service.requestMerge(100);

      expect(service.takeRequest(101)).toBeUndefined();
      expect(service.takeRequest(100)).toBeDefined();
    });

    it('drops a request nobody took in time', () => {
      // Otherwise the merge would pop up later, when the comparison is opened for another reason.
      jasmine.clock().install();
      try {
        jasmine.clock().mockDate(new Date(2026, 10, 20, 12, 0, 0));
        service.requestMerge(100);
        jasmine.clock().tick(31_000);

        expect(service.takeRequest(100)).toBeUndefined();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('tells a view already showing the comparison', () => {
      const seen: number[] = [];
      service.mergeRequest$.subscribe(request => seen.push(request.dbId));

      service.requestMerge(100);

      expect(seen).toEqual([100]);
    });
  });

  describe('a staged copy edited while the merge is open', () => {
    it('is not stale while the staged copy still matches the rows', () => {
      const local = staged();
      dataService.getCachedInstance.and.returnValue(local);

      expect(service.refreshIfStale({ local, database: database(), rows: service.buildRows(local, database()) }))
        .toBeUndefined();
    });

    it('rebuilds the rows, keeping the choices on rows whose values did not change', () => {
      const local = staged();
      const rows = service.buildRows(local, database());
      row(rows, 'definition').choice = 'local';
      row(rows, 'name').choice = 'database';
      // Edited elsewhere meanwhile: another reaction added to hasEvent.
      const current = staged();
      current.attributes.set('hasEvent', [reaction(1), reaction(2), reaction(3), reaction(4)]);
      dataService.getCachedInstance.and.returnValue(current);

      const refreshed = service.refreshIfStale({ local, database: database(), rows })!;

      expect(refreshed.local).toBe(current);
      expect(row(refreshed.rows, 'definition').choice).toEqual('local');
      expect(row(refreshed.rows, 'name').choice).toEqual('database');
      expect(row(refreshed.rows, 'hasEvent').localValues.length).toEqual(4);
    });

    it('notices an attribute that stopped differing', () => {
      const local = staged();
      const rows = service.buildRows(local, database());
      const current = staged();
      current.attributes.set('definition', 'new definition');
      dataService.getCachedInstance.and.returnValue(current);

      const refreshed = service.refreshIfStale({ local, database: database(), rows })!;

      expect(refreshed.rows.map(r => r.attribute.name)).not.toContain('definition');
    });
  });

  describe('detecting a staged copy out of sync with the database', () => {
    it('is out of sync when the modified InstanceEdit differs, as the backend checks', () => {
      expect(service.isOutOfSync(staged(), database())).toBeTrue();
    });

    it('is in sync when both copies carry the same modified InstanceEdit', () => {
      const db = database();
      db.attributes.set('modified', edit(50));

      expect(service.isOutOfSync(staged(), db)).toBeFalse();
    });

    it('is out of sync when modifiedList differs, even with the same modified', () => {
      const local = staged();
      local.attributes.set('modifiedList', [edit(40), edit(50)]);
      const db = database();
      db.attributes.set('modified', edit(50));
      db.attributes.set('modifiedList', [edit(40), edit(45), edit(50)]);

      expect(service.isOutOfSync(local, db)).toBeTrue();

      db.attributes.set('modifiedList', [edit(40), edit(50)]);
      expect(service.isOutOfSync(local, db)).toBeFalse();
    });

    it('ignores modifiedList when one copy was loaded without it', () => {
      const db = database();
      db.attributes.set('modified', edit(50));
      db.attributes.set('modifiedList', [edit(40), edit(50)]);

      expect(service.isOutOfSync(staged(), db)).toBeFalse();
    });

    it('is never out of sync for a new instance or for two different instances', () => {
      const fresh = staged();
      fresh.dbId = -5;
      expect(service.isOutOfSync(fresh, database())).toBeFalse();

      const other = database();
      other.dbId = 200;
      expect(service.isOutOfSync(staged(), other)).toBeFalse();
    });
  });

  it('recognises the backend "updated elsewhere" rejection', () => {
    expect(isInstanceChangedError(new Error(
      'Instance has been updated elsewhere and cannot be committed (dbId, stId, displayName): 1, x, y'))).toBeTrue();
    expect(isInstanceChangedError(new Error('An unexpected error occurred'))).toBeFalse();
  });
});
