import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { CLASSES_AFFECTING_STRUCTURE } from 'src/app/core/models/reactome-schema.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  createMatDialogSpy,
  makeInstance,
  provideDialogContext
} from 'src/testing';
import { ConfirmDeleteDialogService } from './confirm-delete-dialog/confirm-delete-dialog.service';
import { DeletionDialogComponent } from './deletion-dialog.component';

describe('DeletionDialogComponent', () => {
  let component: DeletionDialogComponent;
  let dialogRef: MatDialogRef<DeletionDialogComponent>;
  let confirmService: jasmine.SpyObj<ConfirmDeleteDialogService>;
  let utils: InstanceUtilitiesSpy;

  function build(instance: Instance) {
    utils = createInstanceUtilitiesSpy();
    confirmService = jasmine.createSpyObj<ConfirmDeleteDialogService>(
      'ConfirmDeleteDialogService', ['openDialog']);
    confirmService.openDialog.and.returnValue(createMatDialogSpy().ref as any);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        DeletionDialogComponent,
        ...provideDialogContext(instance),
        { provide: MAT_DIALOG_DATA, useValue: instance },
        { provide: InstanceUtilities, useValue: utils },
        { provide: ConfirmDeleteDialogService, useValue: confirmService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(DeletionDialogComponent);
    return component;
  }

  it('takes the instance to delete from the dialog data', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    expect(build(instance).instance).toBe(instance);
  });

  it('starts with the referrer list collapsed and no count', () => {
    build(makeInstance({ dbId: 100 }));

    expect(component.showReferrersDialog).toBeFalse();
    expect(component.numberOfRefs).toEqual(0);
  });

  it('toggles the referrer list open and closed', () => {
    build(makeInstance({ dbId: 100 }));

    component.showReferrers();
    expect(component.showReferrersDialog).toBeTrue();

    component.showReferrers();
    expect(component.showReferrersDialog).toBeFalse();
  });

  it('records the referrer count reported by the referrer table', () => {
    build(makeInstance({ dbId: 100 }));

    component.setNumberOfRefs(4);

    expect(component.numberOfRefs).toEqual(4);
  });

  it('escalates to the confirmation dialog on OK', () => {
    // This dialog only warns; the confirmation dialog is what actually stages the deletion.
    const instance = makeInstance({ dbId: 100 });
    build(instance).onOK();

    expect(confirmService.openDialog).toHaveBeenCalledWith(instance);
  });

  it('closes with the instance on OK, so the caller knows the flow continued', () => {
    const instance = makeInstance({ dbId: 100 });
    build(instance).onOK();

    expect(dialogRef.close).toHaveBeenCalledWith(instance);
  });

  it('does not open the confirmation dialog when cancelled', () => {
    build(makeInstance({ dbId: 100 })).onCancel();

    expect(confirmService.openDialog).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  describe('structural-change warning', () => {
    it('warns for a class whose deletion changes pathway structure', () => {
      // Deleting an Event/PhysicalEntity/CatalystActivity/Regulation reshapes the diagrams
      // and review status of everything referring to it, so the curator is warned.
      const instance = makeInstance({ dbId: 100, schemaClassName: 'Pathway' });
      build(instance);
      utils.isSchemaClass.and.callFake((_i: Instance, cls: string) => cls === 'Event');

      expect(component.isStructuralChange()).toBeTrue();
    });

    it('does not warn for a class outside the structural set', () => {
      build(makeInstance({ dbId: 100, schemaClassName: 'LiteratureReference' }));
      utils.isSchemaClass.and.returnValue(false);

      expect(component.isStructuralChange()).toBeFalse();
    });

    it('checks the instance against every structural class', () => {
      build(makeInstance({ dbId: 100 }));
      utils.isSchemaClass.and.returnValue(false);

      component.isStructuralChange();

      const checked = utils.isSchemaClass.calls.allArgs().map(args => args[1]);
      expect(checked).toEqual(CLASSES_AFFECTING_STRUCTURE);
    });

    it('stops checking as soon as one structural class matches', () => {
      build(makeInstance({ dbId: 100 }));
      utils.isSchemaClass.and.returnValue(true);

      component.isStructuralChange();

      expect(utils.isSchemaClass).toHaveBeenCalledTimes(1);
    });
  });
});
