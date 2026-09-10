import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CdkDragMove } from '@angular/cdk/drag-drop';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { componentTestImports } from 'src/testing';
import { MainSchemaViewComponent } from './main-schema-view.component';

describe('MainSchemaViewComponent', () => {
  let component: MainSchemaViewComponent;
  /** Drives router events, so the bookmark layout can be observed reacting to navigation. */
  let events: Subject<any>;

  function build(url = '/schema_view/instance/100') {
    events = new Subject();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        MainSchemaViewComponent,
        { provide: Router, useValue: { url, events: events.asObservable() } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    component = TestBed.inject(MainSchemaViewComponent);
    return component;
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('starts with the side panel at its default width and the schema panel closed', () => {
    build();

    expect(component.sideWidth).toEqual(400);
    expect(component.schemaPanelOpen).toBeFalse();
  });

  it('starts with the bookmark drawer closed', () => {
    build();

    expect(component.status).toEqual({ closed: true, opened: false, dragging: false });
  });

  describe('the staged-changes pane', () => {
    it('is hidden on a first visit', () => {
      build().ngOnInit();

      expect(component.showChanged).toBeFalse();
    });

    it('reopens for a curator who left it open', () => {
      sessionStorage.setItem('statusPaneInSchemaView', 'shown');

      build().ngOnInit();

      expect(component.showChanged).toBeTrue();
    });

    it('stays hidden for a curator who closed it', () => {
      sessionStorage.setItem('statusPaneInSchemaView', 'hidden');

      build().ngOnInit();

      expect(component.showChanged).toBeFalse();
    });

    it('remembers being opened', () => {
      build().ngOnInit();

      component.showUpdatedInstances(true);

      expect(component.showChanged).toBeTrue();
      expect(sessionStorage.getItem('statusPaneInSchemaView')).toEqual('shown');
    });

    it('remembers being closed again', () => {
      build().ngOnInit();
      component.showUpdatedInstances(true);

      component.showUpdatedInstances(false);

      expect(component.showChanged).toBeFalse();
      expect(sessionStorage.getItem('statusPaneInSchemaView')).toEqual('hidden');
    });

    it('is remembered per tab rather than across the browser', () => {
      // sessionStorage, not localStorage: each tab keeps its own layout.
      build().ngOnInit();
      component.showUpdatedInstances(true);

      expect(localStorage.getItem('statusPaneInSchemaView')).toBeNull();
    });
  });

  describe('bookmark panel layout', () => {
    it('starts from the current URL, before any navigation has happened', () => {
      build('/schema_view/list_instances/Pathway');
      let layout: string | undefined;
      component.bookmarkLayout$.subscribe(l => (layout = l));

      expect(layout).toEqual('list-view');
    });

    it('anchors below the taller list-view header on the listing route', () => {
      // The list view renders a title bar plus a search field, so the panel sits lower.
      build('/schema_view/instance/100');
      let layout: string | undefined;
      component.bookmarkLayout$.subscribe(l => (layout = l));

      events.next(new NavigationEnd(1, '/x', '/schema_view/list_instances/Pathway'));

      expect(layout).toEqual('list-view');
    });

    it('anchors below the instance-view header on the instance route', () => {
      build('/schema_view/list_instances/Pathway');
      let layout: string | undefined;
      component.bookmarkLayout$.subscribe(l => (layout = l));

      events.next(new NavigationEnd(1, '/x', '/schema_view/instance/100'));

      expect(layout).toEqual('instance-view');
    });

    it('follows the redirected URL rather than the requested one', () => {
      build('/schema_view/instance/100');
      let layout: string | undefined;
      component.bookmarkLayout$.subscribe(l => (layout = l));

      events.next(new NavigationEnd(1, '/schema_view', '/schema_view/list_instances/Pathway'));

      expect(layout).toEqual('list-view');
    });
  });

  it('resizes the side panel to the pointer position', () => {
    build();

    component.resizeLeft({ pointerPosition: { x: 640, y: 200 } } as CdkDragMove);

    expect(component.sideWidth).toEqual(640);
  });

  describe('the bookmark drawer', () => {
    it('opens on click', fakeAsync(() => {
      build();

      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeTrue();
      expect(component.status.closed).toBeFalse();
    }));

    it('closes on a second click', fakeAsync(() => {
      build();
      component.toggleBookmarks();
      tick();

      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeFalse();
      expect(component.status.closed).toBeTrue();
    }));

    it('does not toggle when the click was really the end of a drag', fakeAsync(() => {
      // Dragging the drawer handle ends in a click, which would otherwise snap it shut again.
      build();

      component.onDrag();
      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeFalse();
    }));

    it('accepts clicks again once the drag has settled', fakeAsync(() => {
      build();
      component.onDrag();

      component.onDragEnd();
      tick(10);
      component.toggleBookmarks();
      tick();

      expect(component.status.opened).toBeTrue();
    }));

    it('reports neither open nor closed while being dragged', fakeAsync(() => {
      build();

      component.onDrag();

      expect(component.status).toEqual({ closed: false, opened: false, dragging: true });
    }));
  });
});
