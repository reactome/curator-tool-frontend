import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { Instance, MatchResolution } from '../models/reactome-instance.model';
import { AttributeCategory } from '../models/reactome-schema.model';
import { UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from './data.service';
import { InstanceUtilities } from './instance.service';
import { MatchResolutionService } from './match-resolution.service';

describe('MatchResolutionService', () => {
  let service: MatchResolutionService;
  let dataService: jasmine.SpyObj<DataService>;
  let instUtils: jasmine.SpyObj<InstanceUtilities>;
  let store: jasmine.SpyObj<Store>;

  const schemaClass = {
    name: 'Complex',
    attributes: [
      { name: 'name', cardinality: '+', category: AttributeCategory.MANDATORY },
      { name: 'compartment', cardinality: '1', category: AttributeCategory.OPTIONAL },
      { name: 'hasMember', cardinality: '+', category: AttributeCategory.OPTIONAL },
      { name: 'hasComponent', cardinality: '+', category: AttributeCategory.OPTIONAL },
      { name: '_displayName', cardinality: '1', category: AttributeCategory.NOMANUALEDIT },
    ]
  } as any;

  function makeInstance(dbId: number, attrs: Record<string, any>): Instance {
    return {
      dbId,
      schemaClassName: 'Complex',
      displayName: `inst-${dbId}`,
      schemaClass,
      attributes: new Map<string, any>(Object.entries(attrs)),
    };
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', [
      'getCachedInstance', 'fetchInstance', 'replaceInstanceReferences', 'discardNewInstance',
      'registerInstance', 'handleInstanceAttributes', 'getAttributeNamesNotClonable', 'getSchemaClass'
    ]);
    dataService.getAttributeNamesNotClonable.and.returnValue([]);
    dataService.replaceInstanceReferences.and.returnValue([]);

    instUtils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities', ['makeShell', 'addToModifiedAttributes']);
    instUtils.makeShell.and.callFake((inst: Instance) => ({ dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName }));
    instUtils.addToModifiedAttributes.and.callFake((att: string, inst?: Instance) => {
      if (!inst) return;
      inst.modifiedAttributes = inst.modifiedAttributes ?? [];
      if (!inst.modifiedAttributes.includes(att)) inst.modifiedAttributes.push(att);
    });

    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);

    TestBed.configureTestingModule({
      providers: [
        MatchResolutionService,
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: instUtils },
        { provide: Store, useValue: store },
      ]
    });
    service = TestBed.inject(MatchResolutionService);
  });

  it('returns the new instance for a commit-anyway resolution and applies no side effects', (done) => {
    const newInst = makeInstance(-1, { name: ['A'] });
    dataService.getCachedInstance.and.returnValue(newInst);

    const resolutions: MatchResolution[] = [{ newInstanceDbId: -1, action: 'commit-anyway' }];
    service.resolve(resolutions).subscribe(toCommit => {
      expect(toCommit).toEqual([newInst]);
      expect(dataService.replaceInstanceReferences).not.toHaveBeenCalled();
      expect(dataService.discardNewInstance).not.toHaveBeenCalled();
      done();
    });
  });

  it('use-existing redirects references and discards the new instance', (done) => {
    const newInst = makeInstance(-1, { name: ['A'] });
    const existing = makeInstance(100, { name: ['E'] });
    dataService.getCachedInstance.and.returnValue(newInst);
    dataService.fetchInstance.and.returnValue(of(existing));

    const resolutions: MatchResolution[] = [{ newInstanceDbId: -1, action: 'use-existing', existingInstanceDbId: 100 }];
    service.resolve(resolutions).subscribe(toCommit => {
      expect(toCommit).toEqual([]); // excluded from commit list
      expect(dataService.replaceInstanceReferences).toHaveBeenCalledWith(-1, existing);
      expect(dataService.discardNewInstance).toHaveBeenCalledWith(newInst);
      done();
    });
  });

  it('merge overwrites single-valued, appends multivalued (dedup), and stages the existing instance', (done) => {
    const compA = { dbId: 10, schemaClassName: 'X', displayName: 'a' };
    const compB = { dbId: 11, schemaClassName: 'X', displayName: 'b' };
    const compC = { dbId: 12, schemaClassName: 'X', displayName: 'c' };
    const newInst = makeInstance(-1, {
      name: ['new-name-1', 'new-name-2'],
      compartment: 'cytosol',
      hasMember: [compB, compC], // compB already on existing -> should be skipped (dedup)
      hasComponent: [compB], // stoichiometry: duplicates allowed -> appended even if present
    });
    const existing = makeInstance(100, {
      name: ['existing-name'],
      compartment: 'nucleus',
      hasMember: [compA, compB],
      hasComponent: [compB],
    });
    dataService.getCachedInstance.and.returnValue(newInst);
    dataService.fetchInstance.and.returnValue(of(existing));

    const resolutions: MatchResolution[] = [{ newInstanceDbId: -1, action: 'merge', existingInstanceDbId: 100 }];
    service.resolve(resolutions).subscribe(toCommit => {
      expect(toCommit).toEqual([]);
      // single-valued overwritten with the new value
      expect(existing.attributes.get('compartment')).toBe('cytosol');
      // multivalued appended to the end
      expect(existing.attributes.get('name')).toEqual(['existing-name', 'new-name-1', 'new-name-2']);
      // regular instance list: compB (dbId 11) deduped, compC (dbId 12) added
      expect(existing.attributes.get('hasMember').map((c: any) => c.dbId)).toEqual([10, 11, 12]);
      // stoichiometry relationship: duplicate compB is intentionally appended
      expect(existing.attributes.get('hasComponent').map((c: any) => c.dbId)).toEqual([11, 11]);
      // existing marked modified and staged as an updated instance
      expect(existing.modifiedAttributes).toContain('name');
      expect(existing.modifiedAttributes).toContain('compartment');
      expect(existing.modifiedAttributes).toContain('hasMember');
      expect(existing.modifiedAttributes).toContain('hasComponent');
      expect(dataService.registerInstance).toHaveBeenCalledWith(existing);
      const updateAction = store.dispatch.calls.allArgs()
        .map(args => args[0] as any)
        .find(action => action.type === UpdateInstanceActions.register_updated_instance.type);
      expect(updateAction).toBeTruthy();
      expect(updateAction.dbId).toBe(100);
      // references redirected and new instance discarded
      expect(dataService.replaceInstanceReferences).toHaveBeenCalledWith(-1, existing);
      expect(dataService.discardNewInstance).toHaveBeenCalledWith(newInst);
      done();
    });
  });

  it('resolves an empty list to an empty commit list', (done) => {
    service.resolve([]).subscribe(toCommit => {
      expect(toCommit).toEqual([]);
      done();
    });
  });
});
