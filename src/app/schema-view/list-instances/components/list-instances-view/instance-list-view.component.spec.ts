// MatchInstancesDialogComponent has to be imported before InstanceListViewComponent: there
// is a circular import through MatchResolutionService -> MatchInstancesDialogComponent ->
// ListInstancesModule -> the routing module, and importing the dialog first for its side
// effect is what keeps the component from being used before initialization.
import '../../../../instance/components/match-instances-dialog/match-instances-dialog.component';

import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { delay, of } from 'rxjs';

import { DataService } from '../../../../core/services/data.service';
import { InstanceUtilities } from '../../../../core/services/instance.service';
import { MatchResolutionService } from '../../../../core/services/match-resolution.service';
import { DeletionDialogService } from '../../../../instance/components/deletion-dialog/deletion-dialog.service';
import { ReferrersDialogService } from '../../../../instance/components/referrers-dialog/referrers-dialog.service';
import { BatchEditDialogService } from './batch-edit-dialog/batch-edit-dialog-service';
import { DeleteBulkDialogService } from '../delete-bulk-dialog/delete-bulk-dialog.service';
import { ListInstancesDialogService } from '../list-instances-dialog/list-instances-dialog.service';
import { InstanceListViewComponent } from './instance-list-view.component';

describe('InstanceListViewComponent species quick filter', () => {
  let component: InstanceListViewComponent;
  let dataService: jasmine.SpyObj<DataService>;

  const emptyList = { instances: [], totalCount: 0 };

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService',
      ['listInstances', 'searchInstances', 'fetchSchemaClass', 'isEventClass',
        'isReferenceGeneProductClass', 'getLoadInstanceSubject']);
    dataService.listInstances.and.returnValue(of(emptyList) as any);
    dataService.searchInstances.and.returnValue(of(emptyList) as any);
    dataService.isEventClass.and.returnValue(false);
    dataService.isReferenceGeneProductClass.and.returnValue(false);
    dataService.getLoadInstanceSubject.and.returnValue(undefined as any);

    TestBed.configureTestingModule({
      providers: [
        InstanceListViewComponent,
        { provide: DataService, useValue: dataService },
        { provide: Router, useValue: { url: '/schema_view/list_instances/Pathway', navigate: () => { } } },
        { provide: ActivatedRoute, useValue: { params: of({}), queryParams: of({}) } },
        { provide: Store, useValue: { select: () => of([]), dispatch: () => { } } },
        {
          provide: InstanceUtilities, useValue: {
            deletedDbId$: of(), resetDeletedDbId$: of(),
            committedNewInstDbId$: of(), refreshViewDbId$: of()
          }
        },
        { provide: ReferrersDialogService, useValue: {} },
        { provide: DeletionDialogService, useValue: {} },
        { provide: ListInstancesDialogService, useValue: {} },
        { provide: BatchEditDialogService, useValue: {} },
        { provide: DeleteBulkDialogService, useValue: {} },
        { provide: MatchResolutionService, useValue: {} },
        { provide: MatDialog, useValue: {} },
      ]
    });

    component = TestBed.inject(InstanceListViewComponent);
    component.useRoute = false;
    component.className = 'Pathway';
    component.hasSpeciesAttribute = true;
  });

  /** The (attributes, operands, searchKeys) triple of the last searchInstances call. */
  function lastSearch(): { attributes: string[], operands: string[], searchKeys: string[] } {
    const args = dataService.searchInstances.calls.mostRecent().args;
    return { attributes: args[3] as string[], operands: args[4] as string[], searchKeys: args[5] as string[] };
  }

  it('lists without an attribute search while no filter is applied', () => {
    component.loadInstances();

    expect(dataService.listInstances).toHaveBeenCalled();
    expect(dataService.searchInstances).not.toHaveBeenCalled();
  });

  it('asks for species = Homo sapiens for the human filter', () => {
    component.speciesFilter = 'human';

    component.loadInstances();

    expect(dataService.listInstances).not.toHaveBeenCalled();
    expect(lastSearch()).toEqual({
      attributes: ['species'], operands: ['Equal'], searchKeys: ['Homo sapiens']
    });
  });

  it('asks for species <> Homo sapiens for the non-human filter', () => {
    component.speciesFilter = 'nonhuman';

    component.loadInstances();

    expect(lastSearch()).toEqual({
      attributes: ['species'], operands: ['Not Equal'], searchKeys: ['Homo sapiens']
    });
  });

  it('combines the filter with the text in the search box', () => {
    component.speciesFilter = 'human';
    component.searchKey = 'kinase';

    component.loadInstances();

    expect(lastSearch()).toEqual({
      attributes: ['displayName', 'species'],
      operands: ['Contains', 'Equal'],
      searchKeys: ['kinase', 'Homo sapiens']
    });
  });

  it('keeps a numeric search term a dbId lookup when combined with the filter', () => {
    component.speciesFilter = 'nonhuman';
    component.searchKey = '389513';

    component.loadInstances();

    expect(lastSearch()).toEqual({
      attributes: ['dbId', 'species'],
      operands: ['Equal', 'Not Equal'],
      searchKeys: ['389513', 'Homo sapiens']
    });
  });

  it('adds the filter to the advanced search conditions', () => {
    component.needAdvancedSearch = true;
    component.searchCriteria = [{ attributeName: 'compartment', operand: 'Contains', searchKey: 'cytosol' }];
    component.speciesFilter = 'human';

    component.doAdvancedSearch(0);

    expect(lastSearch()).toEqual({
      attributes: ['compartment', 'species'],
      operands: ['Contains', 'Equal'],
      searchKeys: ['cytosol', 'Homo sapiens']
    });
  });

  it('leaves the advanced search alone while no filter is applied', () => {
    component.needAdvancedSearch = true;
    component.searchCriteria = [{ attributeName: 'compartment', operand: 'Contains', searchKey: 'cytosol' }];

    component.doAdvancedSearch(0);

    expect(lastSearch()).toEqual({
      attributes: ['compartment'], operands: ['Contains'], searchKeys: ['cytosol']
    });
  });

  it('drops a filter carried over to a class that has no species attribute', () => {
    component.speciesFilter = 'human';
    dataService.fetchSchemaClass.and.returnValue(of({
      name: 'Person', attributes: [{ name: 'surname' }, { name: 'firstname' }]
    }) as any);

    component.loadSchemaClassAttributes().subscribe();

    expect(component.hasSpeciesAttribute).toBeFalse();
    expect(component.speciesFilter).toBe('all');
    expect(component.isSpeciesFilterActive()).toBeFalse();
  });

  it('offers the filter on a class that has a species attribute', () => {
    dataService.fetchSchemaClass.and.returnValue(of({
      name: 'Pathway', attributes: [{ name: 'displayName' }, { name: 'species' }]
    }) as any);

    component.loadSchemaClassAttributes().subscribe();

    expect(component.hasSpeciesAttribute).toBeTrue();
  });
});

/**
 * The advanced search over staged instances. The operands have to mean the same thing here as
 * they do in the Cypher the server builds for the database listing (CurationRepository.
 * listInstances), which is what these cases pin down: a missing value matches only the null
 * operands, and Not Equal over a multi-valued attribute is NONE(), not ANY().
 */
describe('InstanceListViewComponent advanced search over staged instances', () => {
  let component: InstanceListViewComponent;
  let dataService: jasmine.SpyObj<DataService>;

  /** dbId -> the value getAttributeValue should see for the searched attribute. */
  let attributeValues: Map<number, any>;

  const SEARCHED_ATTRIBUTE = 'compartment';

  function stagedInstance(dbId: number, value: any): any {
    attributeValues.set(dbId, value);
    return { dbId: dbId, displayName: 'inst' + dbId, schemaClassName: 'Pathway' };
  }

  beforeEach(() => {
    attributeValues = new Map<number, any>();

    dataService = jasmine.createSpyObj<DataService>('DataService',
      ['listInstances', 'searchInstances', 'fetchSchemaClass', 'isEventClass',
        'isReferenceGeneProductClass', 'getLoadInstanceSubject', 'fetchInstance']);
    dataService.isEventClass.and.returnValue(false);
    dataService.isReferenceGeneProductClass.and.returnValue(false);
    dataService.getLoadInstanceSubject.and.returnValue(undefined as any);
    // getAttributeValue reads the full instance through fetchInstance, so the attribute has
    // to arrive as the Map the rest of the code expects rather than a plain object.
    dataService.fetchInstance.and.callFake((dbId: number) => of({
      dbId: dbId,
      attributes: new Map<string, any>([[SEARCHED_ATTRIBUTE, attributeValues.get(dbId)]])
    }) as any);

    TestBed.configureTestingModule({
      providers: [
        InstanceListViewComponent,
        { provide: DataService, useValue: dataService },
        { provide: Router, useValue: { url: '/schema_view/local_list_instances/Pathway', navigate: () => { } } },
        { provide: ActivatedRoute, useValue: { params: of({}), queryParams: of({}) } },
        { provide: Store, useValue: { select: () => of([]), dispatch: () => { } } },
        {
          provide: InstanceUtilities, useValue: {
            deletedDbId$: of(), resetDeletedDbId$: of(),
            committedNewInstDbId$: of(), refreshViewDbId$: of(),
            isInstance: (value: any) => value != null && value.dbId !== undefined
          }
        },
        { provide: ReferrersDialogService, useValue: {} },
        { provide: DeletionDialogService, useValue: {} },
        { provide: ListInstancesDialogService, useValue: {} },
        { provide: BatchEditDialogService, useValue: {} },
        { provide: DeleteBulkDialogService, useValue: {} },
        { provide: MatchResolutionService, useValue: {} },
        { provide: MatDialog, useValue: {} },
      ]
    });

    component = TestBed.inject(InstanceListViewComponent);
    component.useRoute = false;
    component.className = 'Pathway';
    component.isLocal = true;
  });

  /**
   * Run the search over the given staged instances and return the dbIds it kept.
   *
   * The instances are handed over as the updated list. The store double cannot tell the three
   * selectors apart, so it answers by call order instead: combineLatest builds its array
   * left to right, which is updated, then new, then deleted.
   */
  function search(instances: any[], operand: string, searchKey: string): number[] {
    const answers = [instances, [], []];
    let call = 0;
    const store = TestBed.inject(Store) as any;
    store.select = () => of(answers[call++] ?? []);

    component.advancedSearchForLocalInstances([SEARCHED_ATTRIBUTE], [operand], [searchKey]);

    return component.data.map(inst => inst.dbId);
  }

  it('excludes an instance with no value from every operand but IS NULL', () => {
    const missing = () => [stagedInstance(1, null)];

    expect(search(missing(), 'IS NULL', '')).toEqual([1]);
    expect(search(missing(), 'IS NOT NULL', '')).toEqual([]);
    expect(search(missing(), 'Not Equal', 'cytosol')).toEqual([]);
    expect(search(missing(), 'Equal', 'cytosol')).toEqual([]);
    expect(search(missing(), 'Contains', 'cytosol')).toEqual([]);
    expect(search(missing(), 'Regex', '.*')).toEqual([]);
  });

  it('treats an empty multi-valued attribute as no value', () => {
    const empty = () => [stagedInstance(2, [])];

    expect(search(empty(), 'IS NULL', '')).toEqual([2]);
    expect(search(empty(), 'IS NOT NULL', '')).toEqual([]);
    expect(search(empty(), 'Contains', 'cytosol')).toEqual([]);
  });

  it('keeps an instance whose value is there for IS NOT NULL', () => {
    expect(search([stagedInstance(3, 'cytosol')], 'IS NOT NULL', '')).toEqual([3]);
    expect(search([stagedInstance(4, '')], 'IS NOT NULL', '')).toEqual([]);
  });

  it('reads Not Equal over a multi-valued attribute as "no value equals"', () => {
    // [cytosol, nucleoplasm] contains cytosol, so it must not come back for Not Equal
    // cytosol — ANY() semantics would have matched it through nucleoplasm.
    const instances = [
      stagedInstance(5, ['cytosol', 'nucleoplasm']),
      stagedInstance(6, ['nucleoplasm', 'mitochondrion'])
    ];

    expect(search(instances, 'Not Equal', 'cytosol')).toEqual([6]);
  });

  it('matches a multi-valued attribute on any value for the positive operands', () => {
    const instances = [
      stagedInstance(7, ['cytosol', 'nucleoplasm']),
      stagedInstance(8, ['mitochondrion'])
    ];

    expect(search(instances, 'Equal', 'nucleoplasm')).toEqual([7]);
    expect(search(instances, 'Contains', 'chondrion')).toEqual([8]);
  });

  it('matches instance-valued attributes on their display name', () => {
    const instances = [stagedInstance(9, { dbId: 900, displayName: 'cytosol' })];

    expect(search(instances, 'Equal', 'cytosol')).toEqual([9]);
    expect(search(instances, 'Equal', 'nucleoplasm')).toEqual([]);
  });

  it('keeps applying the criteria when fetchInstance answers asynchronously', fakeAsync(() => {
    // DataService answers asynchronously while it is still loading the changed instances, and
    // the subscribe-into-a-local shape this replaced saw undefined for every value then, so
    // the criteria were all evaluated against a missing value.
    const instances = [stagedInstance(10, 'cytosol'), stagedInstance(11, 'nucleoplasm')];
    const asyncValues = new Map(attributeValues);
    dataService.fetchInstance.and.callFake((dbId: number) => of({
      dbId: dbId,
      attributes: new Map<string, any>([[SEARCHED_ATTRIBUTE, asyncValues.get(dbId)]])
    }).pipe(delay(0)) as any);

    const answers: any[] = [instances, [], []];
    let call = 0;
    (TestBed.inject(Store) as any).select = () => of(answers[call++] ?? []);

    component.advancedSearchForLocalInstances([SEARCHED_ATTRIBUTE], ['Equal'], ['cytosol']);
    expect(component.data.map(inst => inst.dbId)).toEqual([]); // nothing has arrived yet

    tick();

    expect(component.data.map(inst => inst.dbId)).toEqual([10]);
  }));
});
