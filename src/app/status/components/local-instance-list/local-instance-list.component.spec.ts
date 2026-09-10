import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { Instance, SelectedInstancesList } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { MatchResolutionService } from 'src/app/core/services/match-resolution.service';
import { DeletionService } from 'src/app/instance/deletion-commit/utils/deletion.service';
import { DeletionDialogService } from 'src/app/instance/components/deletion-dialog/deletion-dialog.service';
import { DeleteBulkDialogService } from 'src/app/schema-view/list-instances/components/delete-bulk-dialog/delete-bulk-dialog.service';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { DeleteInstanceActions } from 'src/app/instance/state/instance.actions';
import { CommitResultDialogService } from './commit-result-dialog/commit-result-dialog.service';
import {
  InstanceUtilitiesSpy,
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  createMatDialogSpy,
  makeInstance,
  makeNewInstance,
  provideRouterStub,
  provideStoreSpy
} from 'src/testing';
import { UpdatedInstanceListComponent } from './local-instance-list.component';

describe('UpdatedInstanceListComponent', () => {
  let component: UpdatedInstanceListComponent;
  let store: StoreSpy;
  let router: any;
  let utils: InstanceUtilitiesSpy;
  let dataService: jasmine.SpyObj<DataService>;
  let deletionService: jasmine.SpyObj<DeletionService>;
  let deletionDialog: jasmine.SpyObj<DeletionDialogService>;
  let deleteBulkDialog: jasmine.SpyObj<DeleteBulkDialogService>;
  let commitResultDialog: jasmine.SpyObj<CommitResultDialogService>;

  function build(staged: Instance[] = [], url = '/schema_view/instance/100') {
    utils = createInstanceUtilitiesSpy();
    deletionService = jasmine.createSpyObj<DeletionService>(
      'DeletionService', ['processDeletion']);
    deletionDialog = jasmine.createSpyObj<DeletionDialogService>(
      'DeletionDialogService', ['openDialog']);
    deleteBulkDialog = jasmine.createSpyObj<DeleteBulkDialogService>(
      'DeleteBulkDialogService', ['openDialog']);
    commitResultDialog = jasmine.createSpyObj<CommitResultDialogService>(
      'CommitResultDialogService', ['openDialog']);
    deleteBulkDialog.openDialog.and.returnValue({ afterClosed: () => of(false) } as any);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        UpdatedInstanceListComponent,
        provideStoreSpy(staged),
        provideRouterStub(url),
        { provide: InstanceUtilities, useValue: utils },
        { provide: DeletionService, useValue: deletionService },
        { provide: DeletionDialogService, useValue: deletionDialog },
        { provide: DeleteBulkDialogService, useValue: deleteBulkDialog },
        { provide: CommitResultDialogService, useValue: commitResultDialog },
        {
          provide: MatchResolutionService,
          useValue: jasmine.createSpyObj('MatchResolutionService', ['resolve'])
        },
        {
          provide: MatchedInstancesDialogService,
          useValue: jasmine.createSpyObj('MatchedInstancesDialogService', ['openDialog'])
        },
        { provide: MatDialog, useValue: createMatDialogSpy() }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    store = TestBed.inject(Store) as unknown as StoreSpy;
    router = TestBed.inject(Router);
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    component = TestBed.inject(UpdatedInstanceListComponent);
    return component;
  }

  afterEach(() => component?.ngOnDestroy());

  const pathway = () => makeInstance({ dbId: 100, displayName: 'Glycolysis' });

  describe('action buttons per bucket', () => {
    it('lets an updated instance be compared, reset, or committed', () => {
      expect(build().updatedInstanceActions.map(b => b.name))
        .toEqual(['compare', 'undo', 'upload']);
    });

    it('lets a deleted instance be reset or committed, but not compared', () => {
      // There is nothing to compare against: the local copy is the deletion itself.
      expect(build().deletedInstanceActions.map(b => b.name)).toEqual(['undo', 'upload']);
    });

    it('lets a new instance be discarded or committed', () => {
      // "Undo" makes no sense for something that never existed in the database.
      expect(build().newInstanceActionButtons.map(b => b.name)).toEqual(['delete', 'upload']);
    });
  });

  describe('reading the staged buckets', () => {
    it('fills all three from the store', () => {
      build([pathway()]).ngOnInit();

      expect(component.newInstances.length).toEqual(1);
      expect(component.updatedInstances.length).toEqual(1);
      expect(component.deletedInstances.length).toEqual(1);
    });

    it('starts each bucket empty before init', () => {
      build([pathway()]);

      expect(component.newInstances).toEqual([]);
    });
  });

  describe('row actions', () => {
    it('opens the deletion dialog for a delete', () => {
      build();
      const instance = pathway();

      component.handleAction({ instance, action: ACTION_BUTTONS.DELETE.name });

      expect(deletionDialog.openDialog).toHaveBeenCalledWith(instance);
    });

    it('resets a staged deletion through the store', () => {
      build();
      const instance = pathway();
      component.deletedInstances = [instance];

      component.handleAction({ instance, action: ACTION_BUTTONS.UNDO.name });

      expect(store.dispatchedActions.map(a => a.type))
        .toContain(DeleteInstanceActions.remove_deleted_instance.type);
    });

    it('resets an edited instance by re-fetching the database copy', () => {
      // The staged edits are discarded by replacing the instance with the server's version.
      build();
      const instance = pathway();
      component.updatedInstances = [instance];
      dataService.fetchInstance.and.returnValue(of(pathway()));

      component.handleAction({ instance, action: ACTION_BUTTONS.UNDO.name });

      expect(dataService.fetchInstance).toHaveBeenCalledWith(100);
    });

    it('commits a staged deletion through the deletion service', () => {
      build();
      const instance = pathway();
      component.deletedInstances = [instance];

      component.handleAction({ instance, action: ACTION_BUTTONS.COMMIT.name });

      expect(deletionService.processDeletion).toHaveBeenCalledWith([instance]);
    });

    it('commits an edited instance and shows the result', () => {
      build();
      const instance = pathway();
      component.updatedInstances = [instance];
      dataService.commit.and.returnValue(of(pathway()));

      component.handleAction({ instance, action: ACTION_BUTTONS.COMMIT.name });

      expect(dataService.commit).toHaveBeenCalledWith(instance);
      expect(utils.processCommit).toHaveBeenCalled();
      expect(commitResultDialog.openDialog).toHaveBeenCalled();
    });

    it('runs the duplicate check before committing a new instance', () => {
      // A new instance may already exist in the database; committing blindly duplicates it.
      build();
      const instance = makeNewInstance({ dbId: -1 });
      component.newInstances = [instance];
      dataService.shouldCheckForMatches.and.returnValue(true);
      dataService.matchInstances.and.returnValue(of([]));

      component.handleAction({ instance, action: ACTION_BUTTONS.COMMIT.name });

      expect(dataService.shouldCheckForMatches).toHaveBeenCalledWith(instance);
    });

    it('compares an updated instance against the database', () => {
      build();
      const instance = pathway();

      component.handleAction({ instance, action: ACTION_BUTTONS.COMPARE2DB.name });

      expect(router.navigate).toHaveBeenCalled();
    });

    it('ignores an action it does not know', () => {
      build();

      component.handleAction({ instance: pathway(), action: 'nonsense' });

      expect(deletionDialog.openDialog).not.toHaveBeenCalled();
      expect(dataService.commit).not.toHaveBeenCalled();
    });
  });

  describe('navigating to an instance', () => {
    it('routes into the schema view by default', () => {
      build();

      component.navigateUrl(pathway());

      expect(router.navigate).toHaveBeenCalledWith(['/schema_view/instance/100']);
    });

    it('does not navigate while the list is being used to pick instances', () => {
      build();
      component.isSelection = true;

      component.navigateUrl(pathway());

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('routes an event into the event view when embedded there', () => {
      // blockRoute marks the event-view copy of this list; a pathway should open its diagram.
      build();
      component.blockRoute = true;
      dataService.isEventClass.and.returnValue(true);

      component.navigateUrl(pathway());

      expect(router.navigate).toHaveBeenCalledWith(['/event_view/instance/100']);
    });

    it('loads a non-event into the event view panel rather than routing', () => {
      // There is no diagram for a PhysicalEntity, so routing would leave a blank view.
      build();
      component.blockRoute = true;
      dataService.isEventClass.and.returnValue(false);

      component.navigateUrl(makeInstance({ dbId: 203, schemaClassName: 'SimpleEntity' }));

      expect(router.navigate).not.toHaveBeenCalled();
      expect(utils.setLastClickedDbId).toHaveBeenCalledWith(203);
    });
  });

  describe('selection', () => {
    it('picks up the shared selections on init', () => {
      build().ngOnInit();

      expect(utils.getSelectedInstances)
        .toHaveBeenCalledWith(SelectedInstancesList.updatedInstanceList);
      expect(utils.getSelectedInstances)
        .toHaveBeenCalledWith(SelectedInstancesList.newInstanceList);
      expect(utils.getSelectedInstances)
        .toHaveBeenCalledWith(SelectedInstancesList.deletedInstanceList);
    });

    it('takes the updated selection reported by the table', () => {
      build();
      const selection = [pathway()];

      component.onUpdatedSelectionChange(selection);

      expect(component.selectedUpdatedInstances).toBe(selection);
    });

    it('shows the checkboxes when select-all is turned on', () => {
      build();

      component.toggleSelectAll(true);

      expect(component.showCheck).toBeTrue();
    });

    it('clears the selection when select-all is turned off', () => {
      build();
      component.selectedUpdatedInstances = [pathway()];

      component.toggleSelectAll(false);

      expect(component.selectedUpdatedInstances).toEqual([]);
      expect(component.showCheck).toBeFalse();
    });

    it('reads the tick state from the shared selection', () => {
      build();
      utils.isInstanceSelected.and.returnValue(true);

      expect(component.isInstanceSelected(
        SelectedInstancesList.updatedInstanceList, pathway())).toBeTrue();
    });

    it('clears a shared selection list on request', () => {
      build();

      component.clearSelectedInstances(SelectedInstancesList.newInstanceList);

      expect(utils.clearSelectedInstances)
        .toHaveBeenCalledWith(SelectedInstancesList.newInstanceList);
    });
  });

  describe('bulk actions', () => {
    it('does nothing when asked to commit an empty updated selection', () => {
      build();
      component.selectedUpdatedInstances = [];

      component.commitUpdatedInstances();

      expect(dataService.commit).not.toHaveBeenCalled();
    });

    it('commits every selected updated instance', () => {
      build();
      component.selectedUpdatedInstances = [pathway(), makeInstance({ dbId: 101 })];
      dataService.commit.and.callFake((inst: Instance) => of(inst));

      component.commitUpdatedInstances();

      expect(dataService.commit).toHaveBeenCalledTimes(2);
    });

    it('commits the selected deletions and clears the selection', () => {
      build();
      const selection = [pathway()];
      component.selectedDeletedInstances = selection;

      component.handleDeletion();

      expect(deletionService.processDeletion).toHaveBeenCalledWith(selection);
      expect(component.selectedDeletedInstances).toEqual([]);
      expect(utils.clearSelectedInstances)
        .toHaveBeenCalledWith(SelectedInstancesList.deletedInstanceList);
    });

    it('confirms before discarding all selected new instances', () => {
      build();
      component.selectedNewInstances = [makeNewInstance({ dbId: -1 })];

      component.deleteAllSelectedNewInstances();

      expect(deleteBulkDialog.openDialog).toHaveBeenCalledWith(component.selectedNewInstances);
    });

    it('resets each selected updated instance and clears the selection', () => {
      build();
      component.selectedUpdatedInstances = [pathway()];
      dataService.fetchInstance.and.returnValue(of(pathway()));

      component.resetSelectedUpdatedInstances();

      expect(dataService.fetchInstance).toHaveBeenCalledWith(100);
      expect(component.selectedUpdatedInstances).toEqual([]);
      expect(component.showCheck).toBeFalse();
    });

    it('resets each selected deletion and clears the selection', () => {
      build();
      component.selectedDeletedInstances = [pathway()];

      component.resetSelectedDeletedInstances();

      expect(store.dispatchedActions.map(a => a.type))
        .toContain(DeleteInstanceActions.remove_deleted_instance.type);
      expect(component.selectedDeletedInstances).toEqual([]);
    });
  });

  it('asks its host to close it', () => {
    build();
    let closed = false;
    component.closeAction.subscribe(() => (closed = true));

    component.close();

    expect(closed).toBeTrue();
  });

  it('stops listening to the store once destroyed', () => {
    build([pathway()]).ngOnInit();

    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
