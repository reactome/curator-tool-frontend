import { CdkDragMove } from '@angular/cdk/drag-drop';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ReactomeEventTypes } from 'ngx-reactome-cytoscape-style';
import { Subject, of } from 'rxjs';

import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeInstance
} from 'src/testing';
import { MainEventComponent } from './main-event.component';

describe('MainEventComponent', () => {
  let component: MainEventComponent;
  let utils: InstanceUtilitiesSpy;
  let dataService: jasmine.SpyObj<DataService>;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  let paramMap: Subject<any>;

  /** Doubles for the child views the component drives through @ViewChild. */
  let instanceView: any;
  let diagramView: any;
  let eventTree: any;

  function build(queryParams: Record<string, any> = {}) {
    utils = createInstanceUtilitiesSpy();
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);
    paramMap = new Subject();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        MainEventComponent,
        { provide: InstanceUtilities, useValue: utils },
        { provide: PageTitleService, useValue: pageTitle },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap.asObservable(),
            params: of({}),
            queryParams: of(queryParams),
            snapshot: { queryParams, paramMap: convertToParamMap({}) }
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    component = TestBed.inject(MainEventComponent);

    instanceView = {
      loadInstance: jasmine.createSpy('loadInstance'),
      instance: undefined as any,
      instanceTable: { inEditing: false }
    };
    diagramView = {
      addEvent: jasmine.createSpy('addEvent'),
      selectObjectsInDiagram: jasmine.createSpy('selectObjectsInDiagram'),
      createEmptyDiagram: jasmine.createSpy('createEmptyDiagram'),
      diagram: { reactomeEvents$: new Subject() }
    };
    eventTree = {
      selectSpecies: jasmine.createSpy('selectSpecies'),
      filterEvents: jasmine.createSpy('filterEvents'),
      selectNodesForDiagram: jasmine.createSpy('selectNodesForDiagram'),
      goToPathway: jasmine.createSpy('goToPathway')
    };
    component.instanceView = instanceView;
    component.diagramView = diagramView;
    component.eventTree = eventTree;
    return component;
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    component?.ngOnDestroy();
    sessionStorage.clear();
  });

  it('sizes the diagram to two thirds of the window height', () => {
    build();

    expect(component.diagramHeight).toBeCloseTo(window.innerHeight * 0.67, 5);
    expect(component.treeWidth).toEqual(400);
  });

  describe('routing to an instance', () => {
    it('notes that the route carries an instance id', () => {
      build().ngOnInit();

      paramMap.next(convertToParamMap({ id: '100' }));

      expect(component.hasInstanceId).toBeTrue();
    });

    it('loads the routed instance once the view has rendered', () => {
      // The instance view is behind an *ngIf, so the id is held until ngAfterViewChecked
      // finds the view -- loading it during the route event would hit an undefined child.
      build().ngOnInit();

      paramMap.next(convertToParamMap({ id: '100' }));
      expect(instanceView.loadInstance).not.toHaveBeenCalled();

      component.ngAfterViewChecked();

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100, false, true);
    });

    it('loads it only once, however many change-detection passes run', () => {
      build().ngOnInit();
      paramMap.next(convertToParamMap({ id: '100' }));

      component.ngAfterViewChecked();
      component.ngAfterViewChecked();

      expect(instanceView.loadInstance).toHaveBeenCalledTimes(1);
    });

    it('prefers the select query parameter over the route id', () => {
      // Opening a diagram deep-linked to a particular reaction: the pathway is in the path,
      // the reaction the curator should land on is in ?select.
      build({ select: '101' }).ngOnInit();

      paramMap.next(convertToParamMap({ id: '100' }));
      component.ngAfterViewChecked();

      expect(instanceView.loadInstance).toHaveBeenCalledWith(101, false, true);
    });

    it('falls back to the route id when select is not a number', () => {
      build({ select: 'not-a-number' }).ngOnInit();

      paramMap.next(convertToParamMap({ id: '100' }));
      component.ngAfterViewChecked();

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100, false, true);
    });

    it('titles the tab after the routed pathway', () => {
      // Without this every event-view tab carries the same static index.html title.
      build().ngOnInit();
      dataService.fetchInstance.and.returnValue(
        of(makeInstance({ dbId: 100, displayName: 'Glycolysis', schemaClassName: 'Pathway' })));

      paramMap.next(convertToParamMap({ id: '100' }));

      expect(pageTitle.setTitle).toHaveBeenCalledWith('Pathway: Glycolysis');
    });

    it('clears the title when the route carries no pathway', () => {
      build().ngOnInit();

      paramMap.next(convertToParamMap({}));

      expect(pageTitle.setTitle).toHaveBeenCalledWith(undefined);
    });

    it('does not re-hold an id when navigating between two instances', () => {
      // Only the no-id -> has-id transition primes the pending load; the instance view
      // handles subsequent navigations itself.
      build().ngOnInit();
      paramMap.next(convertToParamMap({ id: '100' }));
      component.ngAfterViewChecked();
      instanceView.loadInstance.calls.reset();

      paramMap.next(convertToParamMap({ id: '101' }));
      component.ngAfterViewChecked();

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });
  });

  describe('following clicks from other views', () => {
    it('loads an instance clicked anywhere in the app', () => {
      build();

      utils.subjects.lastClickedDbId.next('100');

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100);
    });

    it('accepts a numeric dbId as well as a string one', () => {
      build();

      utils.subjects.lastClickedDbId.next(100);

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100);
    });

    it('opens a comparison for a comparison click', () => {
      build();

      utils.subjects.lastClickedDbIdForComparison.next(100);

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100, true);
    });

    it('refreshes the displayed instance when it is edited elsewhere', () => {
      build();
      instanceView.instance = makeInstance({ dbId: 100 });

      utils.subjects.lastUpdatedInstance.next({
        attribute: 'name', instance: makeInstance({ dbId: 100 })
      });

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100, false, false, true, false);
    });

    it('ignores an edit to an instance that is not on screen', () => {
      build();
      instanceView.instance = makeInstance({ dbId: 100 });

      utils.subjects.lastUpdatedInstance.next({
        attribute: 'name', instance: makeInstance({ dbId: 999 })
      });

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('does not reload while the curator is mid-edit in the table', () => {
      // finishEdit has already refreshed the table in place; re-fetching would swap in a
      // stale instance and clobber the value just added.
      build();
      instanceView.instance = makeInstance({ dbId: 100 });
      instanceView.instanceTable.inEditing = true;

      utils.subjects.lastUpdatedInstance.next({
        attribute: 'hasEvent', instance: makeInstance({ dbId: 100 })
      });

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('stops following clicks once destroyed', () => {
      build();
      component.ngOnDestroy();

      utils.subjects.lastClickedDbId.next('100');

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });
  });

  describe('diagram selection', () => {
    /** A cytoscape-shaped select event over the given reactomeIds. */
    function selectEvent(ids: (number | string | undefined)[], edgeType?: string) {
      return {
        type: ReactomeEventTypes.select,
        detail: {
          element: ids.map(id => ({
            data: (key: string) => (key === 'reactomeId' ? id : edgeType)
          }))
        }
      };
    }

    it('loads the selected object and reveals it in the event tree', () => {
      build();

      component.handleDiagramSelection(selectEvent([101]));

      expect(instanceView.loadInstance).toHaveBeenCalledWith(101, false, true);
      expect(eventTree.selectNodesForDiagram).toHaveBeenCalledWith(101);
    });

    it('ignores anything that is not a selection', () => {
      build();

      component.handleDiagramSelection({ type: 'other', detail: { element: [] } });

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('ignores a flow line, which stands for no instance', () => {
      build();

      component.handleDiagramSelection(selectEvent([101], 'flowLine'));

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('ignores a selection with no reactome ids behind it', () => {
      build();

      component.handleDiagramSelection(selectEvent([undefined, null as any]));

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('does not reload when the same objects are re-selected', () => {
      // Cytoscape re-emits select on every interaction; reloading each time would fight
      // the curator's edits in the instance view.
      build();
      component.handleDiagramSelection(selectEvent([101]));
      instanceView.loadInstance.calls.reset();

      component.handleDiagramSelection(selectEvent([101]));

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('reloads when the selection genuinely changes', () => {
      build();
      component.handleDiagramSelection(selectEvent([101]));
      instanceView.loadInstance.calls.reset();

      component.handleDiagramSelection(selectEvent([102]));

      expect(instanceView.loadInstance).toHaveBeenCalledWith(102, false, true);
    });

    it('collapses duplicate ids from a multi-element selection', () => {
      build();

      component.handleDiagramSelection(selectEvent([101, 101]));
      instanceView.loadInstance.calls.reset();
      component.handleDiagramSelection(selectEvent([101]));

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('ignores a selection whose first id is a diagram-local one', () => {
      // Compartments and edge control points carry synthetic hyphenated ids, not dbIds.
      build();

      component.handleDiagramSelection(selectEvent(['edge-1']));

      expect(instanceView.loadInstance).not.toHaveBeenCalled();
    });

    it('forgets the previous selection when the diagram is cleared', () => {
      build();
      component.handleDiagramSelection(selectEvent([101]));
      component.handleDiagramSelection(selectEvent([]));
      instanceView.loadInstance.calls.reset();

      component.handleDiagramSelection(selectEvent([101]));

      expect(instanceView.loadInstance).toHaveBeenCalledWith(101, false, true);
    });
  });

  describe('delegating to the child views', () => {
    it('adds an event to the diagram', () => {
      build();
      const instance = makeInstance({ dbId: 101 });

      component.addEventToDiagram(instance);

      expect(diagramView.addEvent).toHaveBeenCalledWith(instance);
    });

    it('selects a tree-clicked event in the diagram and loads it', () => {
      build();

      component.handleEventClicked(101);

      expect(diagramView.selectObjectsInDiagram).toHaveBeenCalledWith(101);
      expect(instanceView.loadInstance).toHaveBeenCalledWith(101, false, true);
    });

    it('filters the event tree by species', () => {
      build();

      component.handleSpeciesSelection('Homo sapiens');

      expect(eventTree.selectSpecies).toHaveBeenCalledWith('Homo sapiens');
    });

    it('filters the event tree by text', () => {
      build();

      component.handleEventFilterTextChanged('glyco');

      expect(eventTree.filterEvents).toHaveBeenCalledWith('glyco');
    });

    it('creates an empty diagram for a pathway that has none', () => {
      build();

      component.createEmptyDiagram(100);

      expect(diagramView.createEmptyDiagram).toHaveBeenCalledWith(100);
    });

    it('shows the pathway in the instance view when its diagram is opened', () => {
      build();

      component.handleOpenPathwayDiagramEvent(100);

      expect(instanceView.loadInstance).toHaveBeenCalledWith(100, false, true);
    });

    it('walks the event tree to a requested pathway', () => {
      build();

      component.handleGoToPathEvent(100);

      expect(eventTree.goToPathway).toHaveBeenCalledWith(undefined, 100);
    });
  });

  describe('layout', () => {
    it('restores a staged-changes pane the curator left open', () => {
      sessionStorage.setItem('statusPaneInEventView', 'shown');

      build().ngOnInit();

      expect(component.showChanged).toBeTrue();
    });

    it('keeps the pane hidden on a first visit', () => {
      build().ngOnInit();

      expect(component.showChanged).toBeFalse();
    });

    it('remembers the pane being toggled', () => {
      build().ngOnInit();

      component.showUpdatedInstances(true);

      expect(sessionStorage.getItem('statusPaneInEventView')).toEqual('shown');
    });

    it('resizes the tree to the pointer x', () => {
      build();

      component.resizeLeft({ pointerPosition: { x: 640, y: 300 } } as CdkDragMove);

      expect(component.treeWidth).toEqual(640);
    });

    it('resizes the diagram to the pointer y', () => {
      build();

      component.resizeDown({ pointerPosition: { x: 640, y: 300 } } as CdkDragMove);

      expect(component.diagramHeight).toEqual(300);
    });

    it('does not toggle the bookmark drawer at the end of a drag', fakeAsync(() => {
      build();

      component.onDrag();
      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeFalse();
    }));

    it('toggles the bookmark drawer on a real click', fakeAsync(() => {
      build();

      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeTrue();
    }));
  });
});
