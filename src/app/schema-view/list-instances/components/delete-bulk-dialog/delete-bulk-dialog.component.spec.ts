import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import {
  DeleteInstanceActions,
  NewInstanceActions,
  UpdateInstanceActions
} from 'src/app/instance/state/instance.actions';
import {
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  makeInstance,
  makeNewInstance,
  provideDialogContext
} from 'src/testing';
import { DeleteBulkDialogComponent } from './delete-bulk-dialog.component';

describe('DeleteBulkDialogComponent', () => {
  let component: DeleteBulkDialogComponent;
  let dialogRef: MatDialogRef<DeleteBulkDialogComponent>;
  let store: StoreSpy;
  let utils: jasmine.SpyObj<InstanceUtilities>;

  function build(instances: Instance[]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        DeleteBulkDialogComponent,
        ...provideDialogContext(instances),
        { provide: MAT_DIALOG_DATA, useValue: instances }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    store = TestBed.inject(Store) as unknown as StoreSpy;
    utils = TestBed.inject(InstanceUtilities) as jasmine.SpyObj<InstanceUtilities>;
    utils.makeShell.and.callFake((inst: Instance) => ({
      dbId: inst.dbId,
      displayName: inst.displayName,
      schemaClassName: inst.schemaClassName
    }));
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(DeleteBulkDialogComponent);
    return component;
  }

  const types = () => store.dispatchedActions.map(a => a.type);
  const existing = () => makeInstance({ dbId: 100, displayName: 'Glycolysis' });
  const brandNew = () => makeNewInstance({ dbId: -2 });

  it('takes the selection from the dialog data', () => {
    const instances = [existing()];

    expect(build(instances).instances).toBe(instances);
  });

  it('offers only the remove-from-list action', () => {
    expect(build([existing()]).actionButtons.map(b => b.name)).toEqual(['close']);
  });

  describe('trimming the selection', () => {
    it('drops the instance whose remove button was clicked', () => {
      const keep = makeInstance({ dbId: 101 });
      const drop = makeInstance({ dbId: 100 });
      build([keep, drop]);

      component.handleAction({ instance: drop, action: ACTION_BUTTONS.CLOSE.name });

      expect(component.instances.map(i => i.dbId)).toEqual([101]);
    });

    it('closes itself once the last instance is removed', () => {
      // An empty bulk-delete dialog has nothing left to confirm.
      const only = makeInstance({ dbId: 100 });
      build([only]);

      component.handleAction({ instance: only, action: ACTION_BUTTONS.CLOSE.name });

      expect(dialogRef.close).toHaveBeenCalled();
    });

    it('stays open while instances remain', () => {
      const drop = makeInstance({ dbId: 100 });
      build([drop, makeInstance({ dbId: 101 })]);

      component.handleAction({ instance: drop, action: ACTION_BUTTONS.CLOSE.name });

      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('ignores an action it does not handle', () => {
      build([existing()]);

      component.handleAction({ instance: existing(), action: 'launch' });

      expect(component.instances.length).toEqual(1);
    });
  });

  describe('allInstancesLocal', () => {
    it('is true when every instance is still uncommitted', () => {
      expect(build([brandNew(), makeNewInstance({ dbId: -3 })]).allInstancesLocal()).toBeTrue();
    });

    it('is false as soon as one instance exists in the database', () => {
      // A database instance needs the staged-deletion path, so the dialog warns differently.
      expect(build([brandNew(), existing()]).allInstancesLocal()).toBeFalse();
    });

    it('is true for an empty selection', () => {
      expect(build([]).allInstancesLocal()).toBeTrue();
    });
  });

  describe('deleting', () => {
    it('stages a database instance for deletion', () => {
      build([existing()]).onDelete();

      expect(types()).toContain(DeleteInstanceActions.register_deleted_instance.type);
    });

    it('drops a database instance from the updated list when it had pending edits', () => {
      build([makeInstance({ dbId: 100, modifiedAttributes: ['name'] })]).onDelete();

      expect(types()).toContain(UpdateInstanceActions.remove_updated_instance.type);
    });

    it('leaves the updated list alone for an unedited database instance', () => {
      build([existing()]).onDelete();

      expect(types()).not.toContain(UpdateInstanceActions.remove_updated_instance.type);
    });

    it('removes a new instance and records its deletion as already committed', () => {
      build([brandNew()]).onDelete();

      expect(types()).toContain(NewInstanceActions.remove_new_instance.type);
      expect(types()).toContain(DeleteInstanceActions.commit_deleted_instance.type);
    });

    it('dispatches the commit rather than calling the utility directly', () => {
      // Going through the store is what notifies the bookmark list and the other tabs.
      build([brandNew()]).onDelete();

      expect(utils.setDeletedDbId).not.toHaveBeenCalled();
      expect(types()).toContain(DeleteInstanceActions.commit_deleted_instance.type);
    });

    it('handles a mixed selection, taking each instance down its own path', () => {
      build([existing(), brandNew()]).onDelete();

      expect(types()).toContain(DeleteInstanceActions.register_deleted_instance.type);
      expect(types()).toContain(NewInstanceActions.remove_new_instance.type);
    });

    it('stages shells rather than whole instances', () => {
      build([existing()]).onDelete();

      const action: any = store.actionsOfType(
        DeleteInstanceActions.register_deleted_instance.type)[0];
      expect(action.attributes).toBeUndefined();
    });

    it('closes with the deleted selection', () => {
      const instances = [existing()];
      build(instances).onDelete();

      expect(dialogRef.close).toHaveBeenCalledWith(component.instances);
    });
  });

  it('changes nothing when cancelled', () => {
    build([existing(), brandNew()]).onCancel();

    expect(store.dispatchedActions).toEqual([]);
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
