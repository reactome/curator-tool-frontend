import { TestBed } from '@angular/core/testing';

import { Instance } from '../models/reactome-instance.model';
import { AttributeCategory, SchemaClass } from '../models/reactome-schema.model';
import {
  makeAttribute,
  makeInstance,
  makeInstanceAttribute,
  makeSchemaClass,
  makeShellInstance,
} from 'src/testing';
import { DatabaseSyncService, isInstanceChangedError } from './database-sync.service';

describe('DatabaseSyncService', () => {
  let service: DatabaseSyncService;

  const pathwayClass: SchemaClass = makeSchemaClass('Pathway', {
    attributes: [
      makeAttribute('name', { cardinality: '+', category: AttributeCategory.REQUIRED }),
      makeAttribute('definition'),
      makeInstanceAttribute('hasEvent', ['Event']),
      makeInstanceAttribute('modified', ['InstanceEdit'], { cardinality: '1' }),
      makeInstanceAttribute('modifiedList', ['InstanceEdit'], { cardinality: '+' }),
      makeAttribute('stableIdentifier', { category: AttributeCategory.NOMANUALEDIT }),
    ]
  });
  const attribute = (name: string) => pathwayClass.attributes!.find(a => a.name === name)!;
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
    TestBed.configureTestingModule({ providers: [DatabaseSyncService] });
    service = TestBed.inject(DatabaseSyncService);
  });

  describe('comparison requests', () => {
    it('hands a request to the instance view that asks for it, once', () => {
      // The requester navigates to the comparison, which creates a new instance view; that view
      // takes the request when its comparison has loaded.
      service.requestComparison(100, 'commit refused');

      expect(service.takeRequest(100)).toEqual({ dbId: 100, reason: 'commit refused' });
      expect(service.takeRequest(100)).toBeUndefined();
    });

    it('does not hand a request to a view showing another instance', () => {
      service.requestComparison(100);

      expect(service.takeRequest(101)).toBeUndefined();
      expect(service.takeRequest(100)).toBeDefined();
    });

    it('drops a request nobody took in time', () => {
      // Otherwise the note would pop up later, when the comparison is opened for another reason.
      jasmine.clock().install();
      try {
        jasmine.clock().mockDate(new Date(2026, 10, 20, 12, 0, 0));
        service.requestComparison(100);
        jasmine.clock().tick(31_000);

        expect(service.takeRequest(100)).toBeUndefined();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('tells a view already showing the comparison', () => {
      const seen: number[] = [];
      service.comparisonRequest$.subscribe(request => seen.push(request.dbId));

      service.requestComparison(100);

      expect(seen).toEqual([100]);
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

  describe('per-attribute differences', () => {
    it('compares instances by dbId and lists in order', () => {
      expect(service.differsFromDatabase(staged(), database(), 'modified')).toBeTrue();
      expect(service.differsFromDatabase(staged(), database(), 'hasEvent')).toBeTrue();
      expect(service.differsFromDatabase(staged(), staged(), 'hasEvent')).toBeFalse();

      const reordered = staged();
      reordered.attributes.set('hasEvent', [reaction(2), reaction(1), reaction(3)]);
      expect(service.differsFromDatabase(reordered, staged(), 'hasEvent')).toBeTrue();
    });

    it('treats unset, null, empty string and an empty list as the same "no value"', () => {
      const local = staged();
      local.attributes.set('modifiedList', []);
      local.attributes.set('stableIdentifier', '');

      expect(service.differsFromDatabase(local, database(), 'modifiedList')).toBeFalse();
      expect(service.differsFromDatabase(local, database(), 'stableIdentifier')).toBeFalse();
    });

    it('reports nothing without both copies', () => {
      expect(service.differsFromDatabase(staged(), undefined, 'modified')).toBeFalse();
    });
  });

  describe('lockable attributes', () => {
    it('locks NOMANUALEDIT attributes and the provenance slots', () => {
      expect(service.isLockable(attribute('stableIdentifier'))).toBeTrue();
      expect(service.isLockable(attribute('definition'))).toBeFalse();
    });

    it('locks modified and modifiedList even when the schema does not say NOMANUALEDIT', () => {
      // The test schema above gives them no category at all.
      expect(service.isLockable(attribute('modified'))).toBeTrue();
      expect(service.isLockable(attribute('modifiedList'))).toBeTrue();
    });
  });

  it('pairs modified with modifiedList, and nothing else', () => {
    // Database contract: modified is the last entry of modifiedList, so they are reset together.
    expect(service.provenancePartner('modified')).toEqual('modifiedList');
    expect(service.provenancePartner('modifiedList')).toEqual('modified');
    expect(service.provenancePartner('created')).toBeUndefined();
    expect(service.provenancePartner('definition')).toBeUndefined();
  });

  it('recognises the backend "updated elsewhere" rejection', () => {
    expect(isInstanceChangedError(new Error(
      'Instance has been updated elsewhere and cannot be committed (dbId, stId, displayName): 1, x, y'))).toBeTrue();
    expect(isInstanceChangedError(new Error('An unexpected error occurred'))).toBeFalse();
  });
});
