import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { of, throwError } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { EventTreeComponent } from './event-tree.component';

@Component({ selector: 'release-flag-icon', template: '' })
class ReleaseFlagIconStubComponent {
  @Input() doRelease: boolean | undefined;
}

@Component({ selector: 'class-name-icon', template: '' })
class ClassNameIconStubComponent {
  @Input() className: string | undefined;
}

/**
 * Adding an event to a pathway's hasEvent slot when that event is not already in the tree - a
 * pathway no top-level pathway leads to, or one just created. The event comes off the edited
 * instance, so its attributes are a Map, while the tree is built from the JSON fetchEventTree
 * returns and reads attributes as a plain object. Pushing it in as it is made the tree read
 * undefined for everything: a childless leaf with no release flag, no diagram, and no species
 * (so hidden by any species filter), until the page was reloaded.
 */
describe('EventTreeComponent hasEvent edit', () => {
  let fixture: ComponentFixture<EventTreeComponent>;
  let component: EventTreeComponent;
  let utils: InstanceUtilities;

  // In the tree, as returned by fetchEventTree: attributes are plain objects.
  let reactionInTree: Instance;
  let pathwayInTree: Instance;
  let root: Instance;

  // Outside the tree, as held in DataService's cache: attributes are Maps.
  let cachedAddedChild: Instance;
  let cachedAddedPathway: Instance;
  let cachedEditedPathway: Instance;

  beforeEach(async () => {
    reactionInTree = {
      dbId: 2, displayName: 'A reaction already in the tree', schemaClassName: 'Reaction',
      attributes: { doRelease: true, speciesName: 'Homo sapiens' },
    };
    pathwayInTree = {
      dbId: 1, displayName: 'The edited pathway', schemaClassName: 'Pathway',
      attributes: { hasEvent: [reactionInTree], hasDiagram: true, doRelease: true, speciesName: 'Homo sapiens' },
    };
    root = {
      dbId: 0, displayName: 'TopLevelPathway', schemaClassName: 'TopLevelPathway',
      attributes: { hasEvent: [pathwayInTree] },
    };

    cachedAddedChild = {
      dbId: 501, displayName: 'A reaction under the added pathway', schemaClassName: 'Reaction',
      attributes: new Map<string, any>([['doRelease', true], ['speciesName', 'Homo sapiens']]),
    };
    cachedAddedPathway = {
      dbId: 500, displayName: 'The added pathway', schemaClassName: 'Pathway',
      attributes: new Map<string, any>([
        ['hasEvent', [cachedAddedChild]],
        ['hasDiagram', true],
        ['doRelease', true],
        ['speciesName', 'Homo sapiens'],
      ]),
    };
    // The edited instance as the edit bus hands it over: the cached copy of pathway 1, with the
    // added pathway now in its hasEvent.
    cachedEditedPathway = {
      dbId: 1, displayName: 'The edited pathway', schemaClassName: 'Pathway',
      attributes: new Map<string, any>([['hasEvent', [reactionInTree, cachedAddedPathway]]]),
    };

    const dataService = jasmine.createSpyObj<DataService>('DataService',
      ['fetchEventTree', 'fetchSchemaClassTree', 'fetchInstance', 'getEventTreeCycles']);
    dataService.fetchEventTree.and.returnValue(of(root));
    dataService.fetchSchemaClassTree.and.returnValue(of({} as any));
    dataService.fetchInstance.and.returnValue(of(cachedEditedPathway));
    dataService.getEventTreeCycles.and.returnValue([]); // A sound hierarchy

    await TestBed.configureTestingModule({
      declarations: [EventTreeComponent, ReleaseFlagIconStubComponent, ClassNameIconStubComponent],
      imports: [
        MatTreeModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        RouterTestingModule,
      ],
      providers: [
        InstanceUtilities, // The real one: its edit bus is how the component is driven here
        { provide: DataService, useValue: dataService },
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']) },
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog'])
        },
        // '0' is the "nothing to select" flag the component is given when no event is routed to.
        { provide: ActivatedRoute, useValue: { params: of({ id: '0' }), snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    utils = TestBed.inject(InstanceUtilities);
    fixture = TestBed.createComponent(EventTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function node(dbId: number) {
    return component.treeControl.dataNodes.find(n => n.dbId === dbId);
  }

  /** The curator added pathway 500 to pathway 1's hasEvent slot. */
  function addPathwayToTree() {
    utils.setLastUpdatedInstance('hasEvent', cachedEditedPathway);
    fixture.detectChanges();
  }

  it('builds the tree from the fetched event hierarchy', () => {
    expect(node(1)?.name).toBe('The edited pathway');
    expect(node(2)?.name).toBe('A reaction already in the tree');
  });

  it('shows an added event as the pathway it is, not as a leaf', () => {
    addPathwayToTree();

    const added = node(500);
    expect(added).withContext('the added pathway should appear in the tree').toBeTruthy();
    expect(added!.expandable).withContext('it has a sub-event, so it must be expandable').toBeTrue();
    expect(node(501)?.name).toBe('A reaction under the added pathway');
  });

  it('shows the added event release flag, diagram and species', () => {
    // species in particular: an event with no species is hidden the moment the curator picks one
    // in the species filter, so it would disappear from the tree it was just added to.
    addPathwayToTree();

    const added = node(500)!;
    expect(added.doRelease).toBeTrue();
    expect(added.hasDiagram).toBeTrue();
    expect(added.species).toBe('Homo sapiens');
  });

  it('keeps the events already in the tree as the tree own copies', () => {
    // Reaction 2 is in the tree, so the edit must reuse that node's instance rather than the
    // cached one - the tree's identity lookups (deletion, path caching) depend on it.
    addPathwayToTree();

    expect(node(2)?.instance).toBe(reactionInTree);
    expect(pathwayInTree.attributes['hasEvent']).toContain(reactionInTree);
  });

  it('removes a sub-event of the added event when it is marked for deletion', () => {
    addPathwayToTree();
    expect(node(501)).toBeTruthy();

    utils.setMarkDeletionDbId(501);
    fixture.detectChanges();

    expect(node(501)).withContext('the deleted event should leave the tree').toBeUndefined();
    // The tree splices its own copy of hasEvent. Reaching into the cached instance instead would
    // make marking an event for deletion an unregistered edit of the staged pathway.
    expect(cachedAddedPathway.attributes.get('hasEvent')).toContain(cachedAddedChild);
  });
});

/**
 * Telling the curator about a circular hasEvent relationship.
 *
 * The event view is now the only place this is reported. Editing hasEvent used to be refused
 * outright, which cost a request per ancestor of the edited event to establish what already
 * contained it - on every edit, and hundreds of requests for a batch edit. That check is gone
 * except for the free part (an event put directly in its own hasEvent; see EventCycleCheck), so a
 * curator can create a cycle from the schema view and finds out here, where the hierarchy has to
 * be a hierarchy. The relationship is already dropped by then - by the backend if it is committed,
 * by mergeLocalChangesToEventTree if it is not - so the tree is complete apart from it and the
 * curator can navigate to the event holding it and remove it.
 */
describe('EventTreeComponent circular reference reporting', () => {
  let dataService: jasmine.SpyObj<DataService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const root: Instance = {
    dbId: 0, displayName: 'TopLevelPathway', schemaClassName: 'TopLevelPathway',
    attributes: { hasEvent: [{ dbId: 10, displayName: 'Metabolism', schemaClassName: 'Pathway', attributes: {} }] },
  };

  async function build(cycles: any[], treeFails = false, failure: any = new Error('500 Internal Server Error')) {
    dataService = jasmine.createSpyObj<DataService>('DataService',
      ['fetchEventTree', 'fetchSchemaClassTree', 'fetchInstance', 'getEventTreeCycles']);
    dataService.fetchEventTree.and.returnValue(treeFails
      ? throwError(() => failure)
      : of(root));
    dataService.fetchSchemaClassTree.and.returnValue(of({} as any));
    dataService.getEventTreeCycles.and.returnValue(cycles);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [EventTreeComponent, ReleaseFlagIconStubComponent, ClassNameIconStubComponent],
      imports: [
        MatTreeModule, MatIconModule, MatButtonModule, MatTooltipModule,
        MatProgressSpinnerModule, RouterTestingModule,
      ],
      providers: [
        InstanceUtilities,
        { provide: DataService, useValue: dataService },
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']) },
        { provide: MatDialog, useValue: dialog },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog'])
        },
        { provide: ActivatedRoute, useValue: { params: of({ id: '0' }), snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventTreeComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** What the dialog was given, as one string. */
  function reported(): string {
    const data = dialog.open.calls.mostRecent().args[1]!.data as any;
    return `${data.title}\n${data.message}\n${data.instanceInfo}`;
  }

  it('says nothing when the hierarchy is sound', async () => {
    await build([]);

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('names the containment path and the event to remove it from', async () => {
    await build([{ path: [{ dbId: 10, displayName: 'Metabolism' }, { dbId: 20, displayName: 'Glycolysis' }] }]);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const message = reported();
    // Closed back on the first event, so it reads as a cycle rather than a list.
    expect(message).toContain('Metabolism [10] > Glycolysis [20] > Metabolism [10]');
    // And the one edit that breaks it, which is not obvious from the path alone.
    expect(message).toContain('remove "Metabolism" from the hasEvent of "Glycolysis" [20]');
  });

  it('reads an event listed in its own hasEvent as itself, not as a one-event path', async () => {
    await build([{ path: [{ dbId: 10, displayName: 'Metabolism' }] }]);

    expect(reported()).toContain('Metabolism [10] > itself');
  });

  it('says which cycles are uncommitted edits the curator can still undo', async () => {
    await build([
      { path: [{ dbId: 10, displayName: 'Metabolism' }, { dbId: 20, displayName: 'Glycolysis' }] },
      { path: [{ dbId: 30, displayName: 'Signaling' }, { dbId: 40, displayName: 'MAPK cascade' }], local: true },
    ]);

    const message = reported();
    expect(message).toContain('2 circular hasEvent relationships');
    expect(message).toContain('"MAPK cascade" [40], an uncommitted edit');
    // The committed one is not labelled as an edit of this session's.
    expect(message).toContain('"Glycolysis" [20])');
  });

  it('still builds the tree it was given', async () => {
    // The cycle is already out of the hierarchy, so everything else must still be usable - it is
    // how the curator navigates to the event they have to edit.
    const fixture = await build([{ path: [{ dbId: 10, displayName: 'Metabolism' }] }]);

    expect(fixture.componentInstance.treeControl.dataNodes.some(node => node.dbId === 10)).toBeTrue();
  });

  it('does not blame a circular reference for an expired session', async () => {
    // A 401 fails every request and DataService is already redirecting to the login page; saying
    // the hierarchy is circular would send the curator hunting a data problem that is not there.
    await build([], true, { status: 401, message: '401 Unauthorized' });

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('names a circular reference as the likely cause when the tree cannot be loaded at all', async () => {
    // A backend with no guard recurses until the stack runs out while building the hierarchy, so
    // there is no tree and no cycle list - only a failed request to explain.
    await build([], true);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(reported()).toContain('circular reference');
  });
});

/**
 * A hasEvent edit that puts an event inside something that already contains it, made while the
 * tree is on screen.
 *
 * This edit is not refused (see above), and it does not arrive through the load path either: the
 * tree is handed the new hasEvent on the edit bus and puts it straight into its data. A cycle
 * left in there is not a rendering nuisance - MatTreeFlattener follows hasEvent until the stack
 * runs out, and the tree is then left showing the data it had before, with the added event
 * missing, and stops responding to every later edit as well, because each rebuild hits the same
 * cycle. So the relationship has to be dropped and reported here exactly as it is at load time.
 */
describe('EventTreeComponent hasEvent edit creating a cycle', () => {
  let fixture: ComponentFixture<EventTreeComponent>;
  let component: EventTreeComponent;
  let utils: InstanceUtilities;
  let dialog: jasmine.SpyObj<MatDialog>;

  /** The hierarchy as fetchEventTree returns it: Metabolism > Glycolysis > one reaction. */
  let reactionInTree: Instance;
  let glycolysisInTree: Instance;
  let metabolismInTree: Instance;
  let root: Instance;

  /** A shell, which is all the tree needs to find an event it already holds. */
  function shell(dbId: number, displayName: string, schemaClassName = 'Pathway'): Instance {
    return { dbId, displayName, schemaClassName };
  }

  /** The edited event as the edit bus hands it over: attributes are a Map. */
  function edited(dbId: number, displayName: string, hasEvent: Instance[]): Instance {
    return {
      dbId, displayName, schemaClassName: 'Pathway',
      modifiedAttributes: ['hasEvent'],
      attributes: new Map<string, any>([['hasEvent', hasEvent]]),
    };
  }

  beforeEach(async () => {
    reactionInTree = {
      dbId: 30, displayName: 'A reaction of Glycolysis', schemaClassName: 'Reaction',
      attributes: { doRelease: true, speciesName: 'Homo sapiens' },
    };
    glycolysisInTree = {
      dbId: 20, displayName: 'Glycolysis', schemaClassName: 'Pathway',
      attributes: { hasEvent: [reactionInTree], doRelease: true, speciesName: 'Homo sapiens' },
    };
    metabolismInTree = {
      dbId: 10, displayName: 'Metabolism', schemaClassName: 'Pathway',
      attributes: { hasEvent: [glycolysisInTree], doRelease: true, speciesName: 'Homo sapiens' },
    };
    root = {
      dbId: 0, displayName: 'TopLevelPathway', schemaClassName: 'TopLevelPathway',
      attributes: { hasEvent: [metabolismInTree] },
    };

    const dataService = jasmine.createSpyObj<DataService>('DataService',
      ['fetchEventTree', 'fetchSchemaClassTree', 'fetchInstance', 'getEventTreeCycles']);
    dataService.fetchEventTree.and.returnValue(of(root));
    dataService.fetchSchemaClassTree.and.returnValue(of({} as any));
    dataService.getEventTreeCycles.and.returnValue([]); // The fetched hierarchy is sound
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [EventTreeComponent, ReleaseFlagIconStubComponent, ClassNameIconStubComponent],
      imports: [
        MatTreeModule, MatIconModule, MatButtonModule, MatTooltipModule,
        MatProgressSpinnerModule, RouterTestingModule,
      ],
      providers: [
        InstanceUtilities, // The real one: its edit bus is how the component is driven here
        { provide: DataService, useValue: dataService },
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']) },
        { provide: MatDialog, useValue: dialog },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj<MatchedInstancesDialogService>('MatchedInstancesDialogService', ['openDialog'])
        },
        { provide: ActivatedRoute, useValue: { params: of({ id: '0' }), snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    utils = TestBed.inject(InstanceUtilities);
    fixture = TestBed.createComponent(EventTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function nodes(dbId: number) {
    return component.treeControl.dataNodes.filter(node => node.dbId === dbId);
  }

  /** The curator added Metabolism, which contains Glycolysis, to Glycolysis's hasEvent. */
  function addTheContainerToItsOwnSubPathway() {
    utils.setLastUpdatedInstance('hasEvent',
      edited(20, 'Glycolysis', [shell(30, 'A reaction of Glycolysis', 'Reaction'), shell(10, 'Metabolism')]));
    fixture.detectChanges();
  }

  /** What the dialog was given, as one string. */
  function reported(): string {
    const data = dialog.open.calls.mostRecent().args[1]!.data as any;
    return `${data.title}\n${data.message}\n${data.instanceInfo}`;
  }

  it('keeps the hierarchy usable rather than leaving it as it was', () => {
    addTheContainerToItsOwnSubPathway();

    expect(nodes(10).length).withContext('Metabolism must still be in the tree').toBe(1);
    expect(nodes(20).length).withContext('Glycolysis must still be in the tree').toBe(1);
    expect(nodes(30).length).withContext('and so must its reaction').toBe(1);
  });

  it('leaves the circular relationship out of the tree', () => {
    addTheContainerToItsOwnSubPathway();

    // Metabolism must not appear a second time as a child of the pathway it contains.
    expect(nodes(10)[0].level).toBe(1);
    expect(nodes(20)[0].children?.map(child => child.dbId) ?? []).toEqual([30]);
  });

  it('tells the curator which relationship has to be removed', () => {
    addTheContainerToItsOwnSubPathway();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const message = reported();
    expect(message).toContain('Metabolism [10] > Glycolysis [20] > Metabolism [10]');
    expect(message).toContain('remove "Metabolism" from the hasEvent of "Glycolysis" [20]');
    expect(message).toContain('an uncommitted edit');
  });

  it('says nothing when the edit creates no cycle', () => {
    utils.setLastUpdatedInstance('hasEvent',
      edited(20, 'Glycolysis', [shell(30, 'A reaction of Glycolysis', 'Reaction')]));
    fixture.detectChanges();

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('still shows the next event added, having survived the cyclic edit', () => {
    // The regression this guards: one cyclic edit used to stop the tree updating for good, so
    // every edit after it silently did nothing until the page was reloaded.
    addTheContainerToItsOwnSubPathway();

    utils.setLastUpdatedInstance('hasEvent',
      edited(10, 'Metabolism', [shell(20, 'Glycolysis'), shell(40, 'A newly added reaction', 'Reaction')]));
    fixture.detectChanges();

    expect(nodes(40).length).withContext('the event added after the cyclic edit should appear').toBe(1);
    expect(nodes(40)[0].name).toBe('A newly added reaction');
  });
});
