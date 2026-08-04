import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { Instance, Referrer } from '../models/reactome-instance.model';
import { AttributeCategory, SchemaClass } from '../models/reactome-schema.model';
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from './data.service';
import { InstanceMergeService } from './instance-merge.service';
import { InstanceUtilities } from './instance.service';

describe('InstanceMergeService', () => {
  let service: InstanceMergeService;
  let dataService: jasmine.SpyObj<DataService>;
  let instUtils: jasmine.SpyObj<InstanceUtilities>;
  let store: jasmine.SpyObj<Store>;

  // A small slice of the real hierarchy: PhysicalEntity is abstract, Complex and DefinedSet are
  // concrete siblings under it, so Complex + DefinedSet meet at an abstract class.
  const physicalEntity = {
    name: 'PhysicalEntity', abstract: true,
    attributes: [
      { name: 'name', cardinality: '+', category: AttributeCategory.MANDATORY },
      { name: 'compartment', cardinality: '1', category: AttributeCategory.OPTIONAL },
    ]
  } as any as SchemaClass;
  const complex = {
    name: 'Complex', abstract: false, parent: physicalEntity,
    attributes: [
      { name: 'name', cardinality: '+', category: AttributeCategory.MANDATORY },
      { name: 'compartment', cardinality: '1', category: AttributeCategory.OPTIONAL },
      { name: 'hasComponent', cardinality: '+', category: AttributeCategory.OPTIONAL },
      { name: 'created', cardinality: '1', category: AttributeCategory.OPTIONAL },
      { name: '_displayName', cardinality: '1', category: AttributeCategory.NOMANUALEDIT },
    ]
  } as any as SchemaClass;
  const definedSet = {
    name: 'DefinedSet', abstract: false, parent: physicalEntity,
    attributes: [
      { name: 'name', cardinality: '+', category: AttributeCategory.MANDATORY },
      { name: 'compartment', cardinality: '1', category: AttributeCategory.OPTIONAL },
      { name: 'hasMember', cardinality: '+', category: AttributeCategory.OPTIONAL },
    ]
  } as any as SchemaClass;
  const name2Class = new Map<string, SchemaClass>([
    ['PhysicalEntity', physicalEntity], ['Complex', complex], ['DefinedSet', definedSet]
  ]);

  function makeInstance(dbId: number, className: string, attrs: Record<string, any>): Instance {
    return {
      dbId,
      schemaClassName: className,
      displayName: `inst-${dbId}`,
      schemaClass: name2Class.get(className),
      attributes: new Map<string, any>(Object.entries(attrs)),
    };
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', [
      'getSchemaClass', 'fetchSchemaClass', 'createNewInstance', 'registerInstance',
      'handleInstanceAttributes', 'getAttributeNamesNotClonable', 'replaceInstanceReferences',
      'discardNewInstance', 'getReferrers', 'fetchInstance'
    ]);
    dataService.getAttributeNamesNotClonable.and.returnValue(['created', 'modified']);
    dataService.getSchemaClass.and.callFake((name: string) => name2Class.get(name) ?? ({ name } as SchemaClass));
    dataService.fetchSchemaClass.and.callFake((name: string) => of(name2Class.get(name)!));
    dataService.replaceInstanceReferences.and.returnValue([]);
    dataService.getReferrers.and.returnValue(of([] as Referrer[]));

    instUtils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['makeShell', 'addToModifiedAttributes', 'setMarkDeletionDbId', 'registerDisplayNameChange',
        'isSchemaClass']);
    // Used by InstanceNameGenerator while generating the merged instance's display name.
    instUtils.isSchemaClass.and.returnValue(false);
    instUtils.makeShell.and.callFake((inst: Instance) =>
      ({ dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName }));
    instUtils.addToModifiedAttributes.and.callFake((att: string, inst?: Instance) => {
      if (!inst) return;
      inst.modifiedAttributes = inst.modifiedAttributes ?? [];
      if (!inst.modifiedAttributes.includes(att)) inst.modifiedAttributes.push(att);
    });

    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);

    TestBed.configureTestingModule({
      providers: [
        InstanceMergeService,
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: instUtils },
        { provide: Store, useValue: store },
      ]
    });
    service = TestBed.inject(InstanceMergeService);
  });

  describe('getMergeableAttributes', () => {
    it('drops NOMANUALEDIT and non-clonable provenance attributes', () => {
      const names = service.getMergeableAttributes(complex).map(a => a.name);
      expect(names).toEqual(['name', 'compartment', 'hasComponent']);
    });
  });

  describe('nearestCommonAncestorName', () => {
    it('returns the class itself when both are the same', () => {
      expect(service.nearestCommonAncestorName('Complex', 'Complex')).toBe('Complex');
    });

    it('returns the shared superclass for two siblings', () => {
      expect(service.nearestCommonAncestorName('Complex', 'DefinedSet')).toBe('PhysicalEntity');
    });

    it('returns undefined for unrelated classes', () => {
      expect(service.nearestCommonAncestorName('Complex', 'Nowhere')).toBeUndefined();
    });
  });

  describe('resolveTargetSchemaClass', () => {
    it('uses the shared class when both instances have it', (done) => {
      const first = makeInstance(1, 'Complex', {});
      const second = makeInstance(2, 'Complex', {});
      service.resolveTargetSchemaClass(first, second).subscribe(target => {
        expect(target.schemaClass.name).toBe('Complex');
        expect(target.fallbackNote).toBeUndefined();
        done();
      });
    });

    it('falls back to the first instance class when the common ancestor is abstract', (done) => {
      const first = makeInstance(1, 'Complex', {});
      const second = makeInstance(2, 'DefinedSet', {});
      service.resolveTargetSchemaClass(first, second).subscribe(target => {
        expect(target.schemaClass.name).toBe('Complex');
        expect(target.commonAncestorName).toBe('PhysicalEntity');
        expect(target.fallbackNote).toContain('PhysicalEntity');
        done();
      });
    });
  });

  describe('applyMergeAttributes', () => {
    it('overwrites single-valued and appends multivalued values, deduped', () => {
      const componentA = { dbId: 10, schemaClassName: 'X', displayName: 'a' };
      const componentB = { dbId: 11, schemaClassName: 'X', displayName: 'b' };
      const componentC = { dbId: 12, schemaClassName: 'X', displayName: 'c' };
      const source = makeInstance(-1, 'Complex', {
        name: ['new-1', 'new-2'],
        compartment: 'cytosol',
        hasComponent: [componentB, componentC],
        created: 'should-be-skipped',
      });
      const target = makeInstance(100, 'Complex', {
        name: ['existing'],
        compartment: 'nucleus',
        hasComponent: [componentA, componentB],
      });

      service.applyMergeAttributes(source, target);

      expect(target.attributes.get('compartment')).toBe('cytosol');
      expect(target.attributes.get('name')).toEqual(['existing', 'new-1', 'new-2']);
      expect(target.attributes.get('hasComponent').map((c: any) => c.dbId)).toEqual([10, 11, 12]);
      // 'created' is in the not-clonable list and must never be carried over.
      expect(target.attributes.get('created')).toBeUndefined();
      expect(target.modifiedAttributes).toContain('name');
      expect(target.modifiedAttributes).toContain('compartment');
      expect(target.modifiedAttributes).toContain('hasComponent');
      expect(target.modifiedAttributes).not.toContain('created');
    });

    it('skips attributes the target class does not define', () => {
      const source = makeInstance(1, 'DefinedSet', { hasMember: [{ dbId: 5 }], name: ['n'] });
      const target = makeInstance(2, 'Complex', {});

      service.applyMergeAttributes(source, target);

      expect(target.attributes.get('hasMember')).toBeUndefined();
      expect(target.attributes.get('name')).toEqual(['n']);
    });

    it('unwraps an array source value into a single-valued target attribute', () => {
      const source = makeInstance(1, 'Complex', { compartment: ['cytosol'] });
      const target = makeInstance(2, 'Complex', {});

      service.applyMergeAttributes(source, target);

      expect(target.attributes.get('compartment')).toBe('cytosol');
    });
  });

  describe('createMergedInstance', () => {
    it('applies the picked values honoring cardinality and stages the new instance', (done) => {
      const created: Instance = {
        dbId: -5, schemaClassName: 'Complex', displayName: 'To be generated',
        schemaClass: complex, attributes: new Map<string, any>([['dbId', -5]])
      };
      dataService.createNewInstance.and.returnValue(of(created));

      service.createMergedInstance(complex, [
        { attributeName: 'name', values: ['n1', 'n2'] },
        { attributeName: 'compartment', values: ['cytosol'] },
        { attributeName: 'hasComponent', values: [] },
      ]).subscribe(merged => {
        expect(merged.attributes.get('name')).toEqual(['n1', 'n2']);
        // Single-valued slots take the first picked value, not the array.
        expect(merged.attributes.get('compartment')).toBe('cytosol');
        // An empty selection leaves the slot unset rather than writing an empty list.
        expect(merged.attributes.has('hasComponent')).toBeFalse();
        expect(dataService.registerInstance).toHaveBeenCalledWith(merged);
        const registered = store.dispatch.calls.allArgs().map(args => args[0] as any)
          .find(action => action.type === NewInstanceActions.register_new_instance.type);
        expect(registered?.dbId).toBe(-5);
        done();
      });
    });
  });

  describe('mergeInto', () => {
    it('copies values, repoints references and stages the source for deletion', (done) => {
      const source = makeInstance(200, 'Complex', { name: ['from-source'] });
      const target = makeInstance(100, 'Complex', { name: ['on-target'] });
      const referrer = makeInstance(300, 'Complex', { hasComponent: [{ dbId: 200 }] });
      dataService.getReferrers.and.returnValue(of([
        { attributeName: 'hasComponent', referrers: [{ dbId: 300 } as Instance] }
      ] as Referrer[]));
      dataService.fetchInstance.and.returnValue(of(referrer));
      dataService.replaceInstanceReferences.and.returnValue([referrer]);

      service.mergeInto(source, target).subscribe(result => {
        expect(result.target).toBe(target);
        expect(target.attributes.get('name')).toEqual(['on-target', 'from-source']);
        // Referrers are pulled into the cache before the repointing sweep runs.
        expect(dataService.fetchInstance).toHaveBeenCalledWith(300);
        expect(dataService.replaceInstanceReferences).toHaveBeenCalledWith(200, target);
        expect(result.changedReferrers).toEqual([referrer]);

        const dispatched = store.dispatch.calls.allArgs().map(args => args[0] as any);
        expect(dispatched.find(a => a.type === UpdateInstanceActions.register_updated_instance.type)?.dbId).toBe(100);
        expect(dispatched.find(a => a.type === DeleteInstanceActions.register_deleted_instance.type)?.dbId).toBe(200);
        // The deletion effect signals the views; the merge must not fire that itself as well.
        expect(instUtils.setMarkDeletionDbId).not.toHaveBeenCalled();
        done();
      });
    });

    it('discards an uncommitted new source instead of staging it as a deletion', (done) => {
      const source = makeInstance(-3, 'Complex', { name: ['from-new'] });
      const target = makeInstance(100, 'Complex', {});

      service.mergeInto(source, target).subscribe(() => {
        expect(dataService.discardNewInstance).toHaveBeenCalledWith(source);
        const deleted = store.dispatch.calls.allArgs().map(args => args[0] as any)
          .find(a => a.type === DeleteInstanceActions.register_deleted_instance.type);
        expect(deleted).toBeUndefined();
        done();
      });
    });
  });

  describe('countReferrers', () => {
    it('counts distinct referrer instances across attributes', (done) => {
      dataService.getReferrers.and.returnValue(of([
        { attributeName: 'input', referrers: [{ dbId: 1 } as Instance, { dbId: 2 } as Instance] },
        // dbId 2 refers via two attributes but is still a single referrer instance.
        { attributeName: 'output', referrers: [{ dbId: 2 } as Instance] },
      ] as Referrer[]));

      service.countReferrers(50).subscribe(count => {
        expect(count).toBe(2);
        done();
      });
    });
  });
});
