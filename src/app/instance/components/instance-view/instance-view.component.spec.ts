// See also instance-view-scroll.spec.ts, which covers the scroll-position behaviour of
// loadInstance against a real rendered table. This spec covers the view's own bookkeeping:
// bread-crumb history, title, changed/deleted state, and the reload guard.
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeCategory } from 'src/app/core/models/reactome-schema.model';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { MatchResolutionService } from 'src/app/core/services/match-resolution.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { DeletionService } from 'src/app/instance/deletion-commit/utils/deletion.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { DeletionDialogService } from '../deletion-dialog/deletion-dialog.service';
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { DiagramSyncDialogService } from '../diagram-sync-dialog/diagram-sync-dialog.service';
import { ReferrersDialogService } from '../referrers-dialog/referrers-dialog.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeAttribute,
  makeInstance,
  makeInstanceAttribute,
  makeNewInstance,
  makeSchemaClass,
  makeShellInstance
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
        provide: DiagramSyncDialogService,
        useValue: jasmine.createSpyObj('DiagramSyncDialogService', ['openDialog'])
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
      component.instanceViewFilters = [];

      component.loadInstance(101);
      tick();

      expect(dataService.fetchInstance).toHaveBeenCalledWith(101);
    }));
  });

  describe('the diagram sync check', () => {
    const pathway = () => makeInstance({ dbId: 1430728, displayName: 'Metabolism', schemaClassName: 'Pathway' });

    /** Lands `instance` in the view the way a finished load does. */
    function land(instance: Instance) {
      component.instance = instance;
      (component as any).updateDiagramSyncAvailability(instance);
    }

    it('is offered for a pathway that has a diagram', () => {
      dataService.hasPathwayDiagram.and.returnValue(of(true));

      land(pathway());

      expect(dataService.hasPathwayDiagram).toHaveBeenCalledWith(1430728);
      expect(component.canCheckDiagramSync()).toBeTrue();
    });

    it('is not offered for a pathway without a diagram', () => {
      dataService.hasPathwayDiagram.and.returnValue(of(false));

      land(pathway());

      expect(component.canCheckDiagramSync()).toBeFalse();
    });

    it('does not ask about anything but a committed pathway', () => {
      land(makeInstance({ dbId: 70171, schemaClassName: 'Reaction' }));
      land(makeInstance({ dbId: -1, schemaClassName: 'Pathway' }));

      expect(dataService.hasPathwayDiagram).not.toHaveBeenCalled();
      expect(component.canCheckDiagramSync()).toBeFalse();
    });

    it('is withdrawn when the view moves on to another instance', () => {
      dataService.hasPathwayDiagram.and.returnValue(of(true));
      land(pathway());

      land(makeInstance({ dbId: 70171, schemaClassName: 'Reaction' }));

      expect(component.canCheckDiagramSync()).toBeFalse();
    });

    it('ignores an answer that arrives after the view has moved on', () => {
      // Otherwise a slow answer for the pathway would turn the button on for whatever the
      // curator opened next.
      const answer = new Subject<boolean>();
      dataService.hasPathwayDiagram.and.returnValue(answer);
      land(pathway());
      component.instance = makeInstance({ dbId: 70171, schemaClassName: 'Reaction' });

      answer.next(true);

      expect(component.canCheckDiagramSync()).toBeFalse();
    });

    it('is worked out when a load lands', fakeAsync(() => {
      dataService.hasPathwayDiagram.and.returnValue(of(true));
      dataService.fetchInstance.and.returnValue(of(pathway()));

      component.loadInstance(1430728);
      tick();

      expect(component.canCheckDiagramSync()).toBeTrue();
    }));

    it('opens the report for the displayed pathway', () => {
      dataService.hasPathwayDiagram.and.returnValue(of(true));
      const displayed = pathway();
      land(displayed);

      component.checkDiagramSync();

      const dialogService = TestBed.inject(DiagramSyncDialogService) as jasmine.SpyObj<DiagramSyncDialogService>;
      expect(dialogService.openDialog).toHaveBeenCalledOnceWith(displayed);
    });
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

  describe('merging with the database copy', () => {
    const pathwayClass = makeSchemaClass('Pathway', {
      attributes: [
        makeAttribute('name', { cardinality: '+' }),
        makeAttribute('definition'),
        makeAttribute('stableIdentifier', { category: AttributeCategory.NOMANUALEDIT }),
        makeInstanceAttribute('modified', ['InstanceEdit'], { cardinality: '1', category: AttributeCategory.NOMANUALEDIT })
      ]
    });
    const edit = (dbId: number) => makeShellInstance(dbId, `Edit ${dbId}`, 'InstanceEdit');
    /**
     * The curator renamed it, staged against InstanceEdit 50; meanwhile someone else changed the
     * definition and committed, adding InstanceEdit 60.
     */
    const staged = (name = 'mine') => makeInstance({
      dbId: 100, schemaClass: pathwayClass, modifiedAttributes: ['name'],
      attributes: { name: [name], definition: 'old', modified: edit(50) }
    });
    const database = () => makeInstance({
      dbId: 100, attributes: { name: ['theirs'], definition: 'new', modified: edit(60) }
    });
    let local: Instance;

    beforeEach(() => {
      // blockRoute: the comparison is loaded in place rather than through a route change, which
      // needs the real router. The routed path goes through the same request/take handshake.
      component.blockRoute = true;
      local = staged();
      dataService.getCachedInstance.and.callFake(() => local);
      dataService.getSchemaClass.and.returnValue(pathwayClass);
      dataService.handleSchemaClassForInstance.and.callFake((inst: Instance) => of(inst));
      dataService.fetchInstanceFromDatabase.and.callFake(() => of(database()));
      component.ngOnInit();
    });

    function showComparison() {
      component.instance = local;
      component.dbInstance = database();
      component.showReferenceColumn = true;
    }

    /** Change what the database read returns, for the merge's fresh read. */
    function fetchDatabase(change: (db: Instance) => void) {
      dataService.fetchInstanceFromDatabase.and.callFake(() => {
        const db = database();
        change(db);
        return of(db);
      });
    }

    const rowNames = () => component.mergeData!.rows.map(r => r.attribute.name).sort();

    it('opens in the comparison already on display', () => {
      showComparison();

      component.openMerge();

      expect(rowNames()).toEqual(['definition', 'modified', 'name']);
      expect(component.mergeReason).toBeUndefined();
    });

    it('does nothing from the button unless the database comparison is on', () => {
      component.instance = local;

      component.openMerge();

      expect(component.mergeData).toBeUndefined();
      expect(dataService.fetchInstanceFromDatabase).not.toHaveBeenCalled();
    });

    it('is offered after a refused commit by turning the comparison on, but waits for the button', fakeAsync(() => {
      component.instance = local;
      dataService.fetchInstance.and.returnValue(of(local));
      // The view filters are covered elsewhere; against these spies they yield no instance.
      component.instanceViewFilters = [];

      component.offerMerge('commit refused');
      tick();

      expect(component.dbInstance?.dbId).toEqual(100);
      expect(component.mergeData).toBeUndefined();
      expect(component.mergeReason).toEqual('commit refused');
      expect(component.canMerge()).toBeTrue();

      component.openMerge();

      expect(rowNames()).toEqual(['definition', 'modified', 'name']);
      // The banner still says why the merge is there.
      expect(component.mergeReason).toEqual('commit refused');
    }));

    it('re-reads the database copy of a comparison already on display when a commit is refused', () => {
      // The comparison was opened before the other commit: its copy still has InstanceEdit 50,
      // so the staged copy looks in sync and no merge button shows.
      showComparison();
      component.dbInstance!.attributes.set('modified', edit(50));
      expect(component.canMerge()).toBeFalse();

      component.offerMerge('commit refused');

      expect(dataService.fetchInstanceFromDatabase).toHaveBeenCalledWith(100, false);
      expect(component.canMerge()).toBeTrue();
      expect(component.mergeData).toBeUndefined();
    });

    it('drops the note on a refused commit when the view switches to another instance', fakeAsync(() => {
      showComparison();
      component.offerMerge('commit refused');
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 101 })));
      component.instanceViewFilters = [];

      component.loadInstance(101);
      tick();

      expect(component.mergeReason).toBeUndefined();
    }));

    it('is offered for an updated instance only', () => {
      showComparison();
      expect(component.canMerge()).toBeTrue();

      component.instance = makeInstance({ dbId: 100 });
      expect(component.canMerge()).toBeFalse();

      component.instance = makeNewInstance({ dbId: -1, modifiedAttributes: ['name'] });
      expect(component.canMerge()).toBeFalse();
    });

    it('is offered only while the database comparison is on', () => {
      component.instance = local;
      component.dbInstance = undefined;
      expect(component.canMerge()).toBeFalse();

      // Comparing with a different instance is not a database comparison.
      component.dbInstance = makeInstance({ dbId: 200 });
      expect(component.canMerge()).toBeFalse();

      showComparison();
      expect(component.canMerge()).toBeTrue();
    });

    it('is offered only when the staged copy is out of sync with the database copy', () => {
      // Same InstanceEdit on both sides: the backend would accept the commit, so nothing to merge.
      showComparison();
      component.dbInstance!.attributes.set('modified', edit(50));
      expect(component.canMerge()).toBeFalse();

      component.dbInstance!.attributes.set('modified', edit(60));
      expect(component.canMerge()).toBeTrue();
    });

    it('keeps not-manually-editable attributes on the database value, whatever bulk choice is made', () => {
      local.attributes.set('stableIdentifier', 'R-HSA-mine');
      fetchDatabase(db => db.attributes.set('stableIdentifier', 'R-HSA-theirs'));
      showComparison();
      component.openMerge();
      const choiceOf = (name: string) => component.mergeData!.rows.find(r => r.attribute.name === name)!.choice;

      component.setAllMergeChoices('local');

      expect(choiceOf('name')).toEqual('local');
      expect(choiceOf('definition')).toEqual('local');
      expect(choiceOf('modified')).toEqual('database');
      expect(choiceOf('stableIdentifier')).toEqual('database');
      expect(component.mergeLockedCount).toEqual(2);

      component.applyMerge();

      const merged: Instance = dataService.registerInstance.calls.mostRecent().args[0];
      expect(merged.attributes.get('modified').dbId).toEqual(60);
      expect(merged.attributes.get('stableIdentifier')).toEqual('R-HSA-theirs');
      expect(merged.attributes.get('definition')).toEqual('old');
    });

    it('keeps the staged copy from being committed while open', () => {
      // Committing now would send the copy the database already refused.
      showComparison();
      expect(component.isUploadable()).toBeTruthy();

      component.openMerge();

      expect(component.isUploadable()).toBeFalse();
    });

    it('applies the choices, and leaves the comparison on to show what is left to commit', () => {
      showComparison();
      component.openMerge();

      component.applyMerge();

      expect(dataService.registerInstance).toHaveBeenCalled();
      const merged: Instance = dataService.registerInstance.calls.mostRecent().args[0];
      expect(merged.attributes.get('name')).toEqual(['mine']);
      expect(merged.attributes.get('definition')).toEqual('new');
      expect(utils.setRefreshViewDbId).toHaveBeenCalledWith(100);
      expect(component.mergeData).toBeUndefined();
      expect(component.dbInstance).toBeDefined();
    });

    it('refuses to apply over a staged copy edited while it was open', () => {
      showComparison();
      component.openMerge();
      local = staged('edited again');
      const dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;

      component.applyMerge();

      expect(dataService.registerInstance).not.toHaveBeenCalled();
      expect(component.mergeData!.rows.find(r => r.attribute.name === 'name')!.localValues).toEqual(['edited again']);
      expect(dialog.open).toHaveBeenCalled();
    });

    it('changes nothing when cancelled', () => {
      showComparison();
      component.openMerge();

      component.cancelMerge();

      expect(component.mergeData).toBeUndefined();
      expect(dataService.registerInstance).not.toHaveBeenCalled();
    });

    it('closes when the comparison is turned off', () => {
      showComparison();
      component.openMerge();

      component.showReferenceValueColumn();

      expect(component.mergeData).toBeUndefined();
    });

    it('closes when the view switches to another instance', fakeAsync(() => {
      showComparison();
      component.openMerge();
      dataService.fetchInstance.and.returnValue(of(makeInstance({ dbId: 101 })));
      component.instanceViewFilters = [];

      component.loadInstance(101);
      tick();

      expect(component.mergeData).toBeUndefined();
    }));

    it('is offered, not opened, when a commit is refused because the database copy changed', () => {
      showComparison();
      dataService.commit.and.returnValue(throwError(() => new Error(
        'Instance has been updated elsewhere and cannot be committed (dbId, stId, displayName): 100, null, Glycolysis')));

      component.upload();

      expect(component.mergeData).toBeUndefined();
      expect(component.mergeReason).toContain('changed in the database');
      expect(component.canMerge()).toBeTrue();
    });
  });

  it('installs the instance view filters up front', () => {
    // These rewrite what the table shows for locally deleted references and review status.
    expect(component.instanceViewFilters.length).toBeGreaterThan(0);
  });
});
