/**
 * Self-test for the test harness.
 *
 * The harness is what every other spec's correctness rests on, so a silent breakage here --
 * a spy method renamed out from under `createDataServiceSpy`, a fixture that stops matching
 * the model -- would show up as confusing failures scattered across the suite instead of one
 * clear failure. These tests keep it honest.
 */

import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { DataService } from '../app/core/services/data.service';
import { InstanceUtilities } from '../app/core/services/instance.service';
import { AttributeCategory, AttributeDataType } from '../app/core/models/reactome-schema.model';
import { NewInstanceActions } from '../app/instance/state/instance.actions';
import { newInstances } from '../app/instance/state/instance.selectors';

import {
  EMPTY_INSTANCE_LIST,
  commonTestProviders,
  componentTestImports,
  createAttributeEditServiceSpy,
  createDataServiceSpy,
  createInstanceUtilitiesSpy,
  createRouteStub,
  flattenSchemaTree,
  makeAttribute,
  makeInstance,
  makeInstanceAttribute,
  makeNewInstance,
  makePathwayHierarchy,
  makeSchemaClassTree,
  provideDialogContext,
  resetFixtureIds,
  seedStagedInstances,
  StoreSpy,
  testStoreImports,
  toAttributeMap
} from './index';

describe('test harness: fixtures', () => {
  beforeEach(() => resetFixtureIds());

  it('gives every instance a real Map for attributes, even when handed a plain object', () => {
    // Passing a plain object is the convenient thing to write in a spec, and the app would
    // then fail on `.get()`. The factory normalises it so that mistake is not possible.
    const inst = makeInstance({ attributes: { name: ['Glycolysis'] } as any });

    expect(inst.attributes instanceof Map).toBeTrue();
    expect(inst.attributes.get('name')).toEqual(['Glycolysis']);
  });

  it('hands out distinct dbIds when none is specified', () => {
    expect(makeInstance().dbId).not.toEqual(makeInstance().dbId);
  });

  it('restarts the dbId sequence after resetFixtureIds', () => {
    const first = makeInstance().dbId;
    resetFixtureIds();

    expect(makeInstance().dbId).toEqual(first);
  });

  it('marks a new instance with a negative dbId and the placeholder name', () => {
    const inst = makeNewInstance();

    expect(inst.dbId).toBeLessThan(0);
    expect(inst.displayName).toEqual('To be generated');
  });

  it('copies rather than aliases an attribute Map passed in', () => {
    const source = new Map<string, any>([['name', ['a']]]);
    const inst = makeInstance({ attributes: source });

    inst.attributes.set('definition', 'changed');

    expect(source.has('definition')).toBeFalse();
  });

  it('defaults an attribute to an optional single-valued string', () => {
    const attribute = makeAttribute('definition');

    expect(attribute.cardinality).toEqual('1');
    expect(attribute.category).toEqual(AttributeCategory.OPTIONAL);
    expect(attribute.type).toEqual(AttributeDataType.STRING);
  });

  it('builds a multi-valued instance attribute with its allowed classes', () => {
    const attribute = makeInstanceAttribute('hasEvent', ['Event']);

    expect(attribute.cardinality).toEqual('+');
    expect(attribute.type).toEqual(AttributeDataType.INSTANCE);
    expect(attribute.allowedClases).toEqual(['Event']);
  });

  it('converts undefined, objects, and Maps alike to a Map', () => {
    expect(toAttributeMap(undefined).size).toEqual(0);
    expect(toAttributeMap({ a: 1 }).get('a')).toEqual(1);
    expect(toAttributeMap(new Map([['a', 1]])).get('a')).toEqual(1);
  });

  it('wires the pathway hierarchy so reactions hang off hasEvent with their participants', () => {
    const { pathway, reactions, entities } = makePathwayHierarchy();

    expect(pathway.attributes.get('hasEvent')).toEqual(reactions);
    expect(reactions[0].attributes.get('input')).toEqual([entities[0]]);
    expect(reactions[0].attributes.get('output')).toEqual([entities[1]]);
  });

  it('links parents and descendant sets throughout the schema tree', () => {
    const root = makeSchemaClassTree();
    const byName = flattenSchemaTree(root);

    expect(byName.get('Pathway')!.parent!.name).toEqual('Event');
    expect(byName.get('Event')!.descendants!.has('Reaction')).toBeTrue();
    expect(byName.get('Event')!.descendants!.has('Complex')).toBeFalse();
  });
});

describe('test harness: service doubles', () => {
  it('answers class predicates from the fixture tree instead of always returning false', () => {
    const dataService = createDataServiceSpy();

    expect(dataService.isEventClass('Pathway')).toBeTrue();
    expect(dataService.isEventClass('Complex')).toBeFalse();
    expect(dataService.isPhysicalEntityClass('Complex')).toBeTrue();
    expect(dataService.isReferenceGeneProductClass('ReferenceGeneProduct')).toBeTrue();
  });

  it('returns a subscribable empty page from listInstances, not undefined', done => {
    createDataServiceSpy().listInstances('Pathway', 0, 10, undefined).subscribe(page => {
      expect(page).toEqual(EMPTY_INSTANCE_LIST);
      done();
    });
  });

  it('returns empty Maps from the bulk lookups, so callers can iterate them', done => {
    createDataServiceSpy().fetchDisplayNamesByDbIds([1, 2]).subscribe(names => {
      expect(names instanceof Map).toBeTrue();
      expect(names.size).toEqual(0);
      done();
    });
  });

  it('echoes the instance back from commit, which is what processCommit expects', done => {
    const inst = makeInstance({ dbId: 100 });
    createDataServiceSpy().commit(inst).subscribe(returned => {
      expect(returned.dbId).toEqual(100);
      done();
    });
  });

  it('accepts an override for a single method and keeps the other defaults', done => {
    const dataService = createDataServiceSpy();
    dataService.delete.and.returnValue(of(false) as any);

    dataService.delete(makeInstance()).subscribe(ok => {
      expect(ok).toBeFalse();
      // Untouched default still in place.
      expect(dataService.isEventClass('Pathway')).toBeTrue();
      done();
    });
  });

  it('exposes live Subjects on InstanceUtilities so a spec can emit after ngOnInit', () => {
    const utils = createInstanceUtilitiesSpy();
    const seen: number[] = [];
    utils.deletedDbId$.subscribe(dbId => seen.push(dbId));

    utils.subjects.deletedDbId.next(42);

    expect(seen).toEqual([42]);
  });

  it('returns true from the boolean AttributeEditService methods', () => {
    // A falsy return means "value already present" to the callers, which silently skips the
    // edit -- so the default has to be true or edit specs fail for the wrong reason.
    const edit = createAttributeEditServiceSpy();

    expect(edit.addValueToAttribute({} as any, 'v', makeInstance())).toBeTrue();
    expect(edit.addInstanceViaSelect({} as any, 'v', makeInstance())).toBeTrue();
    expect(edit.onNoInstanceAttributeEdit({} as any, 'v', makeInstance())).toBeTrue();
    expect(edit.setInstanceStoichiometry({} as any, makeInstance(), 2)).toBeTrue();
  });
});

describe('test harness: providers', () => {
  it('supplies a route stub in both observable and snapshot form', () => {
    const route = createRouteStub({ params: { id: '100' }, queryParams: { tab: 'edit' } });
    let observed: any;
    route.params.subscribe(p => (observed = p));

    expect(observed).toEqual({ id: '100' });
    expect(route.snapshot.paramMap.get('id')).toEqual('100');
    expect(route.snapshot.queryParams['tab']).toEqual('edit');
  });

  it('lets commonTestProviders construct a component that injects the core services', () => {
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [...commonTestProviders()]
    });

    expect(TestBed.inject(DataService)).toBeTruthy();
    expect(TestBed.inject(InstanceUtilities)).toBeTruthy();
    expect(TestBed.inject(Store)).toBeTruthy();
  });

  it('provides dialog data and a closable ref for dialog components', () => {
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [...commonTestProviders(), ...provideDialogContext({ dbId: 100 }, 'closed')]
    });

    const data = TestBed.inject(MAT_DIALOG_DATA);
    const ref = TestBed.inject(MatDialogRef);
    let result: unknown;
    ref.afterClosed().subscribe(r => (result = r));

    expect(data).toEqual({ dbId: 100 });
    expect(result).toEqual('closed');
  });

  it('records dispatched actions on the store spy', () => {
    TestBed.configureTestingModule({ providers: [...commonTestProviders()] });
    const store = TestBed.inject(Store) as unknown as StoreSpy;
    const inst = makeNewInstance({ dbId: -3 });

    store.dispatch(NewInstanceActions.register_new_instance(inst));

    expect(store.lastAction()!.type).toEqual(NewInstanceActions.register_new_instance.type);
    expect(store.actionsOfType(NewInstanceActions.register_new_instance.type).length).toEqual(1);
  });
});

describe('test harness: real test store', () => {
  it('runs the app reducers, so a dispatch is observable through the app selectors', () => {
    TestBed.configureTestingModule({ imports: [...testStoreImports()] });
    const store = TestBed.inject(Store);
    const inst = makeNewInstance({ dbId: -5, displayName: 'A new pathway' });

    store.dispatch(NewInstanceActions.register_new_instance(inst));

    let staged: any[] = [];
    store.select(newInstances()).subscribe(list => (staged = list));
    expect(staged.map(i => i.dbId)).toEqual([-5]);
  });

  it('seeds staged edits through the bulk actions', () => {
    TestBed.configureTestingModule({ imports: [...testStoreImports()] });
    const store = TestBed.inject(Store);

    seedStagedInstances(store, {
      newInstances: [makeNewInstance({ dbId: -1 }), makeNewInstance({ dbId: -2 })]
    });

    let staged: any[] = [];
    store.select(newInstances()).subscribe(list => (staged = list));
    expect(staged.length).toEqual(2);
  });
});
