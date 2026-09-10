// See also instance-view-scroll.spec.ts, which covers the scroll-position behaviour of
// loadInstance against a real rendered table. This spec covers the view's own bookkeeping:
// bread-crumb history, title, changed/deleted state, and the reload guard.
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { MatchResolutionService } from 'src/app/core/services/match-resolution.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { DeletionService } from 'src/app/instance/deletion-commit/utils/deletion.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { DeletionDialogService } from '../deletion-dialog/deletion-dialog.service';
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { ReferrersDialogService } from '../referrers-dialog/referrers-dialog.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeInstance,
  makeNewInstance,
  makeSchemaClass
} from 'src/testing';
import { InstanceViewComponent } from './instance-view.component';

describe('InstanceViewComponent', () => {
  let component: InstanceViewComponent;
  let utils: InstanceUtilitiesSpy;
  let dataService: jasmine.SpyObj<DataService>;
  let pageTitle: jasmine.SpyObj<PageTitleService>;

  /** Every collaborator the view injects that has no useful default, stubbed empty. */
  function collaborators() {
    const empty = (name: string, methods: string[]) =>
      ({ provide: name as any, useValue: jasmine.createSpyObj(name, methods) });
    return [
      {
        provide: QAReportDialogService,
        useValue: jasmine.createSpyObj('QAReportDialogService', ['openDialog'])
      },
      {
        provide: ReferrersDialogService,
        useValue: jasmine.createSpyObj('ReferrersDialogService', ['openDialog'])
      },
      {
        provide: DeletionDialogService,
        useValue: jasmine.createSpyObj('DeletionDialogService', ['openDialog'])
      },
      {
        provide: CommitResultDialogService,
        useValue: jasmine.createSpyObj('CommitResultDialogService', ['openDialog'])
      },
      {
        provide: MatchResolutionService,
        useValue: jasmine.createSpyObj('MatchResolutionService', ['resolve'])
      },
      {
        provide: DeletionService,
        useValue: jasmine.createSpyObj('DeletionService', ['commitDeletion'])
      },
      {
        provide: ReviewStatusCheck,
        useValue: jasmine.createSpyObj('ReviewStatusCheck',
          ['checkChangeReviewStatus', 'handleReviewStatus'])
      }
    ];
  }

  beforeEach(() => {
    utils = createInstanceUtilitiesSpy();
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        InstanceViewComponent,
        ...collaborators(),
        { provide: InstanceUtilities, useValue: utils },
        { provide: PageTitleService, useValue: pageTitle }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    // getShellInstance is what goes into the bread-crumb, so it has to return something.
    utils.getShellInstance.and.callFake((inst: Instance) => ({
      dbId: inst.dbId, displayName: inst.displayName, schemaClassName: inst.schemaClassName
    }) as Instance);
    component = TestBed.inject(InstanceViewComponent);
  });

  afterEach(() => component.ngOnDestroy());

  describe('the bread-crumb trail', () => {
    it('starts empty', () => {
      expect(component.viewHistory).toEqual([]);
    });

    it('appends each newly visited instance', () => {
      component.addToViewHistory(makeInstance({ dbId: 100 }));
      component.addToViewHistory(makeInstance({ dbId: 101 }));

      expect(component.viewHistory.map(i => i.dbId)).toEqual([100, 101]);
    });

    it('stores a shell, so a commit does not require reloading the trail', () => {
      component.addToViewHistory(makeInstance({
        dbId: 100, attributes: new Map([['name', ['heavy']]])
      }));

      expect(utils.getShellInstance).toHaveBeenCalled();
      expect(component.viewHistory[0].attributes).toBeUndefined();
    });

    it('truncates back to an instance revisited from outside the bread-crumb', () => {
      // Re-selecting an instance in the staged list or the event tree would otherwise leave
      // the trail pointing past what is actually on display.
      [100, 101, 201].forEach(dbId => component.addToViewHistory(makeInstance({ dbId })));

      component.addToViewHistory(makeInstance({ dbId: 100 }));

      expect(component.viewHistory.map(i => i.dbId)).toEqual([100]);
    });

    it('does not duplicate a revisited instance', () => {
      component.addToViewHistory(makeInstance({ dbId: 100 }));
      component.addToViewHistory(makeInstance({ dbId: 101 }));

      component.addToViewHistory(makeInstance({ dbId: 101 }));

      expect(component.viewHistory.map(i => i.dbId)).toEqual([100, 101]);
    });

    it('matches by dbId, so a reloaded instance is recognised', () => {
      component.addToViewHistory(makeInstance({ dbId: 100, displayName: 'Glycolysis' }));

      component.addToViewHistory(makeInstance({ dbId: 100, displayName: 'Glycolysis (edited)' }));

      expect(component.viewHistory.length).toEqual(1);
    });

    it('ignores an instance with no dbId at all', () => {
      component.addToViewHistory(makeInstance({ dbId: 0 }));

      expect(component.viewHistory).toEqual([]);
    });

    it('ignores an undefined instance', () => {
      component.addToViewHistory(undefined as any);

      expect(component.viewHistory).toEqual([]);
    });
  });

  describe('the title', () => {
    it('names the class, display name, and dbId', () => {
      const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });
      instance.schemaClass = makeSchemaClass('Pathway');

      component.updateTitle(instance);

      expect(component.title).toEqual('Pathway: Glycolysis [100]');
    });

    it('sets the browser tab title to match', () => {
      const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });
      instance.schemaClass = makeSchemaClass('Pathway');

      component.updateTitle(instance);

      expect(pageTitle.setTitle).toHaveBeenCalledWith('Pathway: Glycolysis [100]');
    });

    it('clears the title when nothing is displayed', () => {
      component.updateTitle(undefined as any);

      expect(component.title).toEqual('');
      expect(pageTitle.setTitle).toHaveBeenCalledWith('');
    });
  });

  describe('isChanged', () => {
    it('is true for a new instance', () => {
      component.instance = makeNewInstance({ dbId: -1 });

      expect(component.isChanged()).toBeTrue();
    });

    it('is true for an instance with edited attributes', () => {
      component.instance = makeInstance({ dbId: 100, modifiedAttributes: ['name'] });

      expect(component.isChanged()).toBeTrue();
    });

    it('is true for an instance changed by a deletion elsewhere', () => {
      // A passive edit still has to be committed, so the view must show it as changed.
      component.instance = makeInstance({ dbId: 100, passiveModifiedAttributes: ['hasEvent'] });

      expect(component.isChanged()).toBeTrue();
    });

    it('is false for an untouched database instance', () => {
      component.instance = makeInstance({ dbId: 100 });

      expect(component.isChanged()).toBeFalse();
    });

    it('is false with empty modified lists', () => {
      component.instance = makeInstance({
        dbId: 100, modifiedAttributes: [], passiveModifiedAttributes: []
      });

      expect(component.isChanged()).toBeFalse();
    });

    it('is true when nothing is loaded at all', () => {
      // The dbId defaults to -1, which reads as "new".
      component.instance = undefined;

      expect(component.isChanged()).toBeTrue();
    });
  });

  describe('isDeleted', () => {
    it('is false with nothing loaded', () => {
      expect(component.isDeleted()).toBeFalse();
    });

    it('is false for an instance not staged for deletion', () => {
      component.instance = makeInstance({ dbId: 100 });

      expect(component.isDeleted()).toBeFalse();
    });

    it('is true once the instance is in the deleted list', () => {
      component.instance = makeInstance({ dbId: 100 });
      (component as any).deletedInstances = [makeInstance({ dbId: 100 })];

      expect(component.isDeleted()).toBeTrue();
    });
  });

  describe('the reload guard', () => {
    it('fetches an instance that is not on display', fakeAsync(() => {
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 100 })));

      component.loadInstance(100);
      tick();

      expect(dataService.fetchInstance).toHaveBeenCalledWith(100);
    }));

    it('does nothing without a dbId', () => {
      component.loadInstance(0);

      expect(dataService.fetchInstance).not.toHaveBeenCalled();
    });

    it('skips a reload of the instance already on display', fakeAsync(() => {
      component.instance = makeInstance({ dbId: 100 });

      component.loadInstance(100);
      tick();

      expect(dataService.fetchInstance).not.toHaveBeenCalled();
    }));

    it('reloads the displayed instance when forced', fakeAsync(() => {
      // A post-edit refresh has to get through the guard.
      component.instance = makeInstance({ dbId: 100 });
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 100 })));

      component.loadInstance(100, false, false, true);
      tick();

      expect(dataService.fetchInstance).toHaveBeenCalled();
    }));

    it('loads the database copy when a comparison is asked for and none is held', fakeAsync(() => {
      component.instance = makeInstance({ dbId: 100 });
      component.dbInstance = undefined;
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 100 })));

      component.loadInstance(100, true);
      tick();

      expect(dataService.fetchInstance).toHaveBeenCalled();
    }));

    it('does not show the spinner for a refresh of the displayed instance', fakeAsync(() => {
      // The spinner *ngIf's the attribute table out of the DOM, and the table is what
      // scrolls, so remounting it drops the curator back to the top after every edit.
      component.instance = makeInstance({ dbId: 100 });
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 100 })));

      component.loadInstance(100, false, false, true);

      expect(component.showProgressSpinner).toBeFalse();
      tick();
    }));

    it('shows the spinner when switching to a different instance', fakeAsync(() => {
      component.instance = makeInstance({ dbId: 100 });
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 101 })));

      component.loadInstance(101);
      tick();

      expect(dataService.fetchInstance).toHaveBeenCalledWith(101);
    }));
  });

  describe('hasRemovedNewInstanceRef', () => {
    const removedRef = () => {
      utils.isPermanentlyRemovedNewInstance.and.callFake((dbId: number) => dbId === -5);
    };

    it('is false with nothing loaded', () => {
      expect((component as any).hasRemovedNewInstanceRef(new Set())).toBeFalse();
    });

    it('spots a discarded new instance still referenced from a multi-valued slot', () => {
      removedRef();
      component.instance = makeInstance({
        dbId: 100,
        attributes: new Map([['hasEvent', [{ dbId: -5, schemaClassName: 'Reaction' }]]])
      });

      expect((component as any).hasRemovedNewInstanceRef(new Set())).toBeTrue();
    });

    it('spots one referenced from a single-valued slot', () => {
      removedRef();
      component.instance = makeInstance({
        dbId: 100,
        attributes: new Map([['reviewStatus', { dbId: -5, schemaClassName: 'ReviewStatus' }]])
      });

      expect((component as any).hasRemovedNewInstanceRef(new Set())).toBeTrue();
    });

    it('ignores a new instance that is still staged', () => {
      removedRef();
      component.instance = makeInstance({
        dbId: 100,
        attributes: new Map([['hasEvent', [{ dbId: -5, schemaClassName: 'Reaction' }]]])
      });

      expect((component as any).hasRemovedNewInstanceRef(new Set([-5]))).toBeFalse();
    });

    it('ignores references to committed instances', () => {
      removedRef();
      component.instance = makeInstance({
        dbId: 100,
        attributes: new Map([['hasEvent', [{ dbId: 101, schemaClassName: 'Reaction' }]]])
      });

      expect((component as any).hasRemovedNewInstanceRef(new Set())).toBeFalse();
    });

    it('ignores empty and scalar slots', () => {
      removedRef();
      component.instance = makeInstance({
        dbId: 100,
        attributes: new Map<string, any>([
          ['name', ['Glycolysis']],
          ['definition', undefined],
          ['doRelease', true]
        ])
      });

      expect((component as any).hasRemovedNewInstanceRef(new Set())).toBeFalse();
    });
  });

  it('toggles the database-comparison column', () => {
    // blockRoute so the toggle does not also try to rewrite the URL, which needs the real
    // router; the routing side of it is exercised through the app rather than here.
    component.blockRoute = true;
    component.instance = makeInstance({ dbId: 100 });
    expect(component.showReferenceColumn).toBeFalse();

    component.showReferenceValueColumn();
    expect(component.showReferenceColumn).toBeTrue();

    component.showReferenceValueColumn();
    expect(component.showReferenceColumn).toBeFalse();
  });

  it('installs the instance view filters up front', () => {
    // These rewrite what the table shows for locally deleted references and review status.
    expect(component.instanceViewFilters.length).toBeGreaterThan(0);
  });
});
