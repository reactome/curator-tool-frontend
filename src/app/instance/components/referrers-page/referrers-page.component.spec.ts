import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Instance, Referrer } from '../../../core/models/reactome-instance.model';
import { DataService } from '../../../core/services/data.service';
import { ReferrersPageComponent } from './referrers-page.component';

describe('ReferrersPageComponent', () => {
  let component: ReferrersPageComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let params: Subject<any>;

  const instance = { dbId: 71553, displayName: 'Some reaction', schemaClassName: 'Reaction' } as Instance;

  function shell(dbId: number, displayName: string, schemaClassName: string): Instance {
    return { dbId, displayName, schemaClassName } as Instance;
  }

  beforeEach(() => {
    params = new Subject<any>();
    dataService = jasmine.createSpyObj<DataService>('DataService', ['fetchInstance', 'getReferrers']);
    dataService.fetchInstance.and.returnValue(of(instance));
    dataService.getReferrers.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        ReferrersPageComponent,
        { provide: DataService, useValue: dataService },
        { provide: ActivatedRoute, useValue: { params: params.asObservable() } },
      ]
    });

    component = TestBed.inject(ReferrersPageComponent);
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('loads the instance and its referrers for the dbId in the URL', () => {
    dataService.getReferrers.and.returnValue(of([
      { attributeName: 'hasEvent', referrers: [shell(70221, 'Glycogen breakdown', 'Pathway')] },
    ] as Referrer[]));

    params.next({ dbId: '71553' });

    expect(dataService.fetchInstance).toHaveBeenCalledWith(71553);
    expect(dataService.getReferrers).toHaveBeenCalledWith(71553);
    expect(component.instance).toBe(instance);
    expect(component.totalCount).toBe(1);
    expect(component.showProgressSpinner).toBeFalse();
    expect(component.errorMessage).toBeUndefined();
  });

  it('sorts the groups by attribute name and drops empty ones', () => {
    dataService.getReferrers.and.returnValue(of([
      { attributeName: 'precedingEvent', referrers: [shell(453339, 'a', 'Reaction'), shell(453358, 'b', 'Reaction')] },
      { attributeName: 'hasEvent', referrers: [shell(70221, 'c', 'Pathway')] },
      { attributeName: 'nothingHere', referrers: [] },
    ] as Referrer[]));

    params.next({ dbId: '71553' });

    expect(component.referrerGroups.map(group => group.attributeName)).toEqual(['hasEvent', 'precedingEvent']);
    expect(component.totalCount).toBe(3);
  });

  it('reloads when the route moves to another instance', () => {
    params.next({ dbId: '71553' });
    params.next({ dbId: '70189' });

    expect(dataService.getReferrers.calls.allArgs()).toEqual([[71553], [70189]]);
  });

  it('reports a non-numeric dbId without calling the server', () => {
    params.next({ dbId: 'not-an-id' });

    expect(dataService.fetchInstance).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('not-an-id');
    expect(component.showProgressSpinner).toBeFalse();
  });

  it('reports an instance that cannot be loaded and stops the spinner', () => {
    dataService.fetchInstance.and.returnValue(throwError(() => new Error('404')));

    params.next({ dbId: '99999999' });

    expect(component.errorMessage).toContain('99999999');
    expect(component.showProgressSpinner).toBeFalse();
    expect(component.referrerGroups).toEqual([]);
  });

  it('builds the instance link and label used by the table', () => {
    const referrer = shell(70221, 'Glycogen breakdown (glycogenolysis)', 'Pathway');

    expect(component.instanceLink(referrer)).toEqual(['/schema_view', 'instance', 70221]);
    expect(component.instanceLabel(referrer)).toBe('[Pathway:70221] Glycogen breakdown (glycogenolysis)');
  });
});
