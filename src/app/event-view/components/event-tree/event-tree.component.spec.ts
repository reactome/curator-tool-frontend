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
import { of } from 'rxjs';

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
      ['fetchEventTree', 'fetchSchemaClassTree', 'fetchInstance']);
    dataService.fetchEventTree.and.returnValue(of(root));
    dataService.fetchSchemaClassTree.and.returnValue(of({} as any));
    dataService.fetchInstance.and.returnValue(of(cachedEditedPathway));

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
