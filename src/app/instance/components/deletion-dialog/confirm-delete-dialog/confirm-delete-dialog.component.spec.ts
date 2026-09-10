import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { DataService } from 'src/app/core/services/data.service';
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
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';

describe('ConfirmDeleteDialogComponent', () => {
  let component: ConfirmDeleteDialogComponent;
  let store: StoreSpy;
  let dataService: jasmine.SpyObj<DataService>;
  let utils: jasmine.SpyObj<InstanceUtilities>;
  let dialogRef: MatDialogRef<ConfirmDeleteDialogComponent>;

  function build(instance: Instance) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        ConfirmDeleteDialogComponent,
        ...provideDialogContext(instance),
        { provide: MAT_DIALOG_DATA, useValue: instance },
        {
          provide: ReviewStatusCheck,
          useValue: jasmine.createSpyObj<ReviewStatusCheck>(
            'ReviewStatusCheck', ['checkChangeReviewStatus', 'handleReviewStatus'])
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    store = TestBed.inject(Store) as unknown as StoreSpy;
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    utils = TestBed.inject(InstanceUtilities) as jasmine.SpyObj<InstanceUtilities>;
    // The component stages a *shell*, not the full instance, so the store slice stays light.
    utils.makeShell.and.callFake((inst: Instance) => ({
      dbId: inst.dbId,
      displayName: inst.displayName,
      schemaClassName: inst.schemaClassName
    }));
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(ConfirmDeleteDialogComponent);
    return component;
  }

  const types = (s: StoreSpy) => s.dispatchedActions.map(a => a.type);

  describe('an instance that exists in the database', () => {
    const existing = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    it('stages the deletion rather than applying it', () => {
      build(existing).onDelete();

      expect(types(store)).toContain(DeleteInstanceActions.register_deleted_instance.type);
    });

    it('stages a shell, not the whole instance', () => {
      build(existing).onDelete();

      const action: any = store.actionsOfType(
        DeleteInstanceActions.register_deleted_instance.type)[0];
      expect(action.dbId).toEqual(100);
      expect(action.attributes).toBeUndefined();
    });

    it('does not repair referrers yet, since the database still points at it validly', () => {
      // Referrers keep pointing at this instance until the deletion is committed;
      // DeletedInstanceAttributeFilter handles the display-only filtering meanwhile.
      build(existing).onDelete();

      expect(dataService.synchronizeDeletedReferrers).not.toHaveBeenCalled();
    });

    it('drops it from the updated list when it had pending edits', () => {
      // Otherwise the instance would sit in both the updated and the deleted bucket.
      const edited = makeInstance({
        dbId: 100, displayName: 'Glycolysis', modifiedAttributes: ['name']
      });

      build(edited).onDelete();

      expect(types(store)).toContain(UpdateInstanceActions.remove_updated_instance.type);
    });

    it('leaves the updated list alone when it had no pending edits', () => {
      build(existing).onDelete();

      expect(types(store)).not.toContain(UpdateInstanceActions.remove_updated_instance.type);
    });

    it('leaves the updated list alone when modifiedAttributes is present but empty', () => {
      build(makeInstance({ dbId: 100, modifiedAttributes: [] })).onDelete();

      expect(types(store)).not.toContain(UpdateInstanceActions.remove_updated_instance.type);
    });

    it('closes with the instance so the caller knows what was deleted', () => {
      build(existing).onDelete();

      expect(dialogRef.close).toHaveBeenCalledWith(existing);
    });
  });

  describe('a new, uncommitted instance', () => {
    const brandNew = makeNewInstance({ dbId: -2, displayName: 'To be generated' });

    it('removes it from the new list outright', () => {
      build(brandNew).onDelete();

      expect(types(store)).toContain(NewInstanceActions.remove_new_instance.type);
    });

    it('records the deletion as already committed, since there is no staged phase', () => {
      build(brandNew).onDelete();

      expect(types(store)).toContain(DeleteInstanceActions.commit_deleted_instance.type);
    });

    it('repairs referrers immediately', () => {
      // Nothing in the database ever pointed here, so the local references have to be
      // fixed up now rather than at commit time.
      dataService.synchronizeDeletedReferrers.and.returnValue(of([]));

      build(brandNew).onDelete();

      expect(dataService.synchronizeDeletedReferrers).toHaveBeenCalledWith([brandNew]);
    });

    it('does not stage it as a pending deletion', () => {
      build(brandNew).onDelete();

      expect(types(store)).not.toContain(DeleteInstanceActions.register_deleted_instance.type);
    });

    it('closes with the instance', () => {
      build(brandNew).onDelete();

      expect(dialogRef.close).toHaveBeenCalledWith(brandNew);
    });
  });

  it('takes the instance to delete from the dialog data', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    expect(build(instance).instance).toBe(instance);
  });

  it('changes nothing when cancelled', () => {
    build(makeInstance({ dbId: 100 })).onCancel();

    expect(store.dispatchedActions).toEqual([]);
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
