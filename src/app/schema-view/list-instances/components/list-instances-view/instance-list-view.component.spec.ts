// MatchInstancesDialogComponent has to be imported before InstanceListViewComponent: there
// is a circular import through MatchResolutionService -> MatchInstancesDialogComponent ->
// ListInstancesModule -> the routing module, and importing the dialog first for its side
// effect is what keeps the component from being used before initialization.
import '../../../../instance/components/match-instances-dialog/match-instances-dialog.component';

import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

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
