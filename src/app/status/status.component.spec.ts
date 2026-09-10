import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { Instance, MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { DefaultPersonActions } from 'src/app/instance/state/instance.actions';
import { UserInstancesService } from '../auth/login/user-instances.service';
import { DiagramEditorService } from '../event-view/components/pathway-diagram/utils/diagram-editor.service';
import { ListInstancesDialogService } from '../schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service';
import { UserInstanceBackupsDialogService } from './components/user-instance-backups-dialog/user-instance-backups-dialog.service';
import {
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  createMatDialogSpy,
  makeInstance,
  makeNewInstance,
  provideStoreSpy
} from 'src/testing';
import { StatusComponent } from './status.component';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let store: StoreSpy;
  let router: any;
  let dataService: jasmine.SpyObj<DataService>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;
  let listInstancesDialog: jasmine.SpyObj<ListInstancesDialogService>;
  let diagramEditor: jasmine.SpyObj<DiagramEditorService>;
  let backupsDialog: jasmine.SpyObj<UserInstanceBackupsDialogService>;
  let dialog: ReturnType<typeof createMatDialogSpy>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;
  let routerEvents: Subject<any>;
  let errorMessages: Subject<Error>;
  let locks: BehaviorSubject<any[]>;

  /**
   * Builds the component. `staged` is what every instance selector returns, so a spec can
   * push the component over the staging limit by passing a long enough list.
   */
  function build(staged: Instance[] = [], url = '/schema_view/instance/100') {
    routerEvents = new Subject();
    errorMessages = new Subject();
    locks = new BehaviorSubject<any[]>([]);

    userInstances = jasmine.createSpyObj<UserInstancesService>(
      'UserInstancesService', ['persistInstances', 'loadUserInstances',
        'importUserInstancesFromFile', 'exportUserInstances']);
    listInstancesDialog = jasmine.createSpyObj<ListInstancesDialogService>(
      'ListInstancesDialogService', ['openDialog']);
    diagramEditor = jasmine.createSpyObj<DiagramEditorService>('DiagramEditorService',
      ['observePathwayDiagramLocksViewModels', 'getCachedDiagramLock', 'unlockDiagram']);
    backupsDialog = jasmine.createSpyObj<UserInstanceBackupsDialogService>(
      'UserInstanceBackupsDialogService', ['openDialog']);
    dialog = createMatDialogSpy();

    diagramEditor.observePathwayDiagramLocksViewModels.and.returnValue(locks.asObservable() as any);
    listInstancesDialog.openDialog.and.returnValue({ afterClosed: () => of(undefined) } as any);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        StatusComponent,
        provideStoreSpy(staged),
        {
          provide: Router,
          useValue: {
            url,
            events: routerEvents.asObservable(),
            navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true))
          }
        },
        { provide: UserInstancesService, useValue: userInstances },
        { provide: ListInstancesDialogService, useValue: listInstancesDialog },
        { provide: DiagramEditorService, useValue: diagramEditor },
        { provide: UserInstanceBackupsDialogService, useValue: backupsDialog },
        { provide: MatDialog, useValue: dialog }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    store = TestBed.inject(Store) as unknown as StoreSpy;
    router = TestBed.inject(Router);
    snackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    (dataService as any).errorMessage$ = errorMessages.asObservable();
    component = TestBed.inject(StatusComponent);
    return component;
  }

  afterEach(() => component?.ngOnDestroy());

  describe('tracking the current route', () => {
    it('starts from the URL the tab is already on', () => {
      build([], '/schema_view/instance/100').ngOnInit();

      expect(component.currentUrl).toEqual('/schema_view/instance/100');
    });

    it('follows navigation, using the redirected URL', () => {
      build([], '/home').ngOnInit();

      routerEvents.next(new NavigationEnd(1, '/schema_view', '/schema_view/list_instances/Pathway'));

      expect(component.currentUrl).toEqual('/schema_view/list_instances/Pathway');
    });

    it('ignores router events other than a completed navigation', () => {
      build([], '/home').ngOnInit();

      routerEvents.next({ id: 2, url: '/elsewhere' });

      expect(component.currentUrl).toEqual('/home');
    });
  });

  describe('staged instances', () => {
    it('reads the staged buckets out of the store', () => {
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      expect(component.updatedInstances.length).toEqual(1);
      expect(component.newInstances.length).toEqual(1);
      expect(component.deletedInstances.length).toEqual(1);
    });

    it('does not warn about the staging limit for a normal amount of work', () => {
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      expect(component.saveChangesInProgress).toBeFalse();
    });

    it('warns once the staged total exceeds the limit', () => {
      // The three buckets are summed, so the limit is reached at a third of it in each here.
      const many = Array.from({ length: MAX_STAGED_INSTANCES }, (_, i) =>
        makeInstance({ dbId: i + 1 }));

      build(many).ngOnInit();

      expect(component.saveChangesInProgress).toBeTrue();
    });

    it('takes the single default person out of its selector list', () => {
      build([makeInstance({ dbId: 1, schemaClassName: 'Person' })]).ngOnInit();

      expect(component.defaultPerson!.dbId).toEqual(1);
    });

    it('reports no default person for an empty selector list', () => {
      build([]).ngOnInit();

      expect(component.defaultPerson).toBeUndefined();
    });
  });

  describe('choosing a default person', () => {
    it('opens the instance picker restricted to Person', () => {
      build().setDefaultPerson();

      expect(listInstancesDialog.openDialog).toHaveBeenCalledWith(
        { schemaClass: { name: 'Person' }, title: 'Select default person' });
    });

    it('stores the chosen person', () => {
      build();
      const person = makeInstance({ dbId: 1, schemaClassName: 'Person' });
      listInstancesDialog.openDialog.and.returnValue({ afterClosed: () => of(person) } as any);

      component.setDefaultPerson();

      expect(store.lastAction()!.type).toEqual(DefaultPersonActions.set_default_person.type);
    });

    it('keeps the current person when the picker is dismissed', () => {
      build();
      listInstancesDialog.openDialog.and.returnValue({ afterClosed: () => of(undefined) } as any);

      component.setDefaultPerson();

      expect(store.dispatchedActions).toEqual([]);
    });
  });

  describe('persisting staged edits', () => {
    it('persists with a beacon when the tab is closing', () => {
      // A normal request is cancelled as the page unloads; a beacon survives it.
      build().persistInstances();

      expect(userInstances.persistInstances).toHaveBeenCalledWith(false, undefined, true);
    });

    it('persists then navigates to login on logout', () => {
      build();
      userInstances.persistInstances.and.callFake(
        (_removeToken?: boolean, onComplete?: any) => onComplete?.(true));

      component.logout();

      expect(userInstances.persistInstances).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('does not auto-persist merely from the state it loaded with', fakeAsync(() => {
      // The chain skips its first emission: arriving at a page with staged edits already in
      // the store is not edit activity, and persisting then would write on every navigation.
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      tick(6 * 60 * 1000);

      expect(userInstances.persistInstances).not.toHaveBeenCalled();
    }));

    it('auto-persists five idle minutes after an edit', fakeAsync(() => {
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      store.setSelectResult([makeInstance({ dbId: 100 }), makeInstance({ dbId: 101 })]);
      tick(5 * 60 * 1000);

      expect(userInstances.persistInstances).toHaveBeenCalled();
    }));

    it('does not auto-persist before the idle period is up', fakeAsync(() => {
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      store.setSelectResult([makeInstance({ dbId: 101 })]);
      tick(4 * 60 * 1000);

      expect(userInstances.persistInstances).not.toHaveBeenCalled();
      tick(60 * 1000);
    }));

    it('restarts the idle timer when another edit lands', fakeAsync(() => {
      // debounceTime, not throttle: continuous editing must not trigger a write mid-session.
      build([makeInstance({ dbId: 100 })]).ngOnInit();

      store.setSelectResult([makeInstance({ dbId: 101 })]);
      tick(4 * 60 * 1000);
      store.setSelectResult([makeInstance({ dbId: 102 })]);
      tick(4 * 60 * 1000);

      expect(userInstances.persistInstances).not.toHaveBeenCalled();
      tick(60 * 1000);
      expect(userInstances.persistInstances).toHaveBeenCalled();
    }));
  });

  describe('surfacing errors', () => {
    it('shows a data-layer error in a snackbar', () => {
      build().ngOnInit();

      errorMessages.next(new Error('Commit failed: constraint violation'));

      expect(snackBar.open)
        .toHaveBeenCalledWith('Commit failed: constraint violation', 'Close');
    });

    it('stays quiet about a refresh-token failure', () => {
      // Token refresh is handled silently; surfacing it would alarm the curator over an
      // error the app is already recovering from.
      build().ngOnInit();

      errorMessages.next(new Error('Refresh token has expired'));

      expect(snackBar.open).not.toHaveBeenCalled();
    });

    it('stays quiet about an expired token', () => {
      build().ngOnInit();

      errorMessages.next(new Error('Token expired'));

      expect(snackBar.open).not.toHaveBeenCalled();
    });

    it('stays quiet about an auth endpoint failure', () => {
      build().ngOnInit();

      errorMessages.next(new Error('POST /api/auth/refresh failed'));

      expect(snackBar.open).not.toHaveBeenCalled();
    });

    it('falls back to the error name when it carries no message', () => {
      build().ngOnInit();
      const error = new Error();
      error.name = 'HttpErrorResponse';

      errorMessages.next(error);

      expect(snackBar.open)
        .toHaveBeenCalledWith('There is an error: HttpErrorResponse', 'Close');
    });
  });

  describe('the diagram locks panel', () => {
    it('shows as loading before the locks arrive', () => {
      // observePathwayDiagramLocksViewModels can emit synchronously from a warm cache, so
      // the flag has to be set before subscribing or the panel sticks on "Loading locks...".
      build();
      diagramEditor.observePathwayDiagramLocksViewModels.and.returnValue(new Subject() as any);

      component.ngOnInit();

      expect(component.pathwayDiagramLocksLoading).toBeTrue();
    });

    it('lists the locks once they arrive', () => {
      build().ngOnInit();

      locks.next([{ diagramDbId: 900, displayName: 'Glycolysis', hasBackupDiagram: false }]);

      expect(component.pathwayDiagramLocks.length).toEqual(1);
      expect(component.pathwayDiagramLocksLoading).toBeFalse();
    });

    it('toggles the panel open and closed', () => {
      build();

      component.togglePathwayDiagramLocksPanel();
      expect(component.showPathwayDiagramLocksPanel).toBeTrue();

      component.togglePathwayDiagramLocksPanel();
      expect(component.showPathwayDiagramLocksPanel).toBeFalse();
    });

    it('closes on a click outside it', () => {
      build();
      component.showPathwayDiagramLocksPanel = true;
      const outside = document.createElement('div');

      component.closePathwayDiagramLocksPanelOnOutsideClick(
        { target: outside } as unknown as MouseEvent);

      expect(component.showPathwayDiagramLocksPanel).toBeFalse();
    });

    it('stays open on a click inside it', () => {
      build();
      component.showPathwayDiagramLocksPanel = true;
      const wrapper = document.createElement('div');
      wrapper.className = 'diagram-locks-wrapper';
      const inside = document.createElement('button');
      wrapper.appendChild(inside);

      component.closePathwayDiagramLocksPanelOnOutsideClick(
        { target: inside } as unknown as MouseEvent);

      expect(component.showPathwayDiagramLocksPanel).toBeTrue();
    });

    it('does nothing on an outside click while already closed', () => {
      build();

      expect(() => component.closePathwayDiagramLocksPanelOnOutsideClick(
        { target: document.createElement('div') } as unknown as MouseEvent)).not.toThrow();
      expect(component.showPathwayDiagramLocksPanel).toBeFalse();
    });
  });

  describe('unlocking a diagram', () => {
    const lock = { diagramDbId: 900, displayName: 'Glycolysis', hasBackupDiagram: false } as any;

    it('unlocks directly when there is nothing unsaved to upload', () => {
      build();
      diagramEditor.getCachedDiagramLock.and.returnValue({ diagramDbId: 900 } as any);
      diagramEditor.unlockDiagram.and.returnValue(of(true) as any);

      component.unlockPathwayDiagram(lock);

      expect(diagramEditor.unlockDiagram).toHaveBeenCalled();
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('asks what to do about an unsaved backup first', () => {
      // Unlocking would otherwise silently discard edits the curator never uploaded.
      build();
      diagramEditor.getCachedDiagramLock.and.returnValue({ diagramDbId: 900 } as any);

      component.unlockPathwayDiagram({ ...lock, hasBackupDiagram: true });

      expect(dialog.open).toHaveBeenCalled();
    });

    it('reports success', () => {
      build();
      diagramEditor.getCachedDiagramLock.and.returnValue({ diagramDbId: 900 } as any);
      diagramEditor.unlockDiagram.and.returnValue(of(true) as any);

      component.unlockPathwayDiagram(lock);

      expect(snackBar.open).toHaveBeenCalledWith('Unlocked "Glycolysis".', 'Close');
    });

    it('explains when the lock details are not known', () => {
      build();
      diagramEditor.getCachedDiagramLock.and.returnValue(null);

      component.unlockPathwayDiagram(lock);

      expect(diagramEditor.unlockDiagram).not.toHaveBeenCalled();
      expect(snackBar.open).toHaveBeenCalledWith(
        'Unable to unlock this diagram: lock information is unavailable.', 'Close');
    });
  });

  describe('navigation', () => {
    it('goes home', () => {
      build().navigateHome();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('goes to the schema view', () => {
      build().navigateToSchemaView();

      expect(router.navigate).toHaveBeenCalledWith(['/schema_view']);
    });

    it('goes to the event view', () => {
      build().navigateToEventView();

      expect(router.navigate).toHaveBeenCalledWith(['/event_view']);
    });

    it('opens a locked diagram in the event view', () => {
      build().openPathwayDiagram(900);

      expect(router.navigate).toHaveBeenCalledWith(['/event_view', 'instance', 900]);
    });

    it('refuses to navigate to a non-numeric diagram id', () => {
      build().openPathwayDiagram('abc' as any);

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  it('asks the parent view to show the staged-changes pane', () => {
    build();
    const emitted: boolean[] = [];
    component.showUpdatedEvent.subscribe(v => emitted.push(v));

    component.showUpdated();

    expect(emitted).toEqual([true]);
  });

  it('opens the staged-edit backups dialog', () => {
    build().openUserInstanceBackups();

    expect(backupsDialog.openDialog).toHaveBeenCalled();
  });

  it('stops listening to the store and the router once destroyed', () => {
    build([makeNewInstance({ dbId: -1 })]).ngOnInit();

    component.ngOnDestroy();
    routerEvents.next(new NavigationEnd(1, '/x', '/elsewhere'));

    expect(component.currentUrl).not.toEqual('/elsewhere');
  });
});
