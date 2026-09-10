import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { AttributeValue } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  makeInstanceAttribute,
  makeNewInstance
} from 'src/testing';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';

// The scroll-to-name behaviour, which needs the real overlay to observe, has its own specs in
// new-instance-dialog-scroll-to-name.spec.ts and new-instance-dialog-layout.spec.ts. These
// cover the class selection and the dialog result.
describe('NewInstanceDialogComponent', () => {
  let component: NewInstanceDialogComponent;
  let dialogRef: MatDialogRef<NewInstanceDialogComponent>;
  let dataService: jasmine.SpyObj<DataService>;
  let store: StoreSpy;

  const slot: AttributeValue = {
    attribute: makeInstanceAttribute('hasEvent', ['Event']),
    value: undefined
  };

  function build(candidateClasses: string[] = ['Pathway', 'Reaction'], data = slot) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        NewInstanceDialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close'),
            // afterOpened has to emit: it is what flips dialogOpened, and the component
            // subscribes in its constructor.
            afterOpened: () => of(undefined),
            afterClosed: () => of(undefined)
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.setCandidateClasses.and.returnValue(candidateClasses);
    dataService.createNewInstance.and.callFake((schemaClassName: string) =>
      of(makeNewInstance({ dbId: -1, schemaClassName })));
    store = TestBed.inject(Store) as unknown as StoreSpy;
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(NewInstanceDialogComponent);
    return component;
  }

  it('offers the classes the slot allows', () => {
    build(['Pathway', 'Reaction']);

    expect(dataService.setCandidateClasses).toHaveBeenCalledWith(slot.attribute);
    expect(component.candidateClasses).toEqual(['Pathway', 'Reaction']);
  });

  it('opens on the first candidate class', () => {
    build(['Pathway', 'Reaction']);

    expect(component.selected).toEqual('Pathway');
  });

  it('creates an instance of the opening class straight away', () => {
    // The table has to have something to render before the curator touches anything.
    build(['Pathway', 'Reaction']);

    expect(dataService.createNewInstance).toHaveBeenCalledWith('Pathway');
    expect(component.instance!.schemaClassName).toEqual('Pathway');
  });

  it('creates a fresh instance when the class is changed', () => {
    build(['Pathway', 'Reaction']);
    component.selected = 'Reaction';

    component.onSelectionChange();

    expect(dataService.createNewInstance).toHaveBeenCalledWith('Reaction');
    expect(component.instance!.schemaClassName).toEqual('Reaction');
  });

  it('replaces the instance rather than keeping the previous class', () => {
    build(['Pathway', 'Reaction']);
    const first = component.instance;
    component.selected = 'Reaction';

    component.onSelectionChange();

    expect(component.instance).not.toBe(first);
  });

  describe('confirming', () => {
    it('caches the new instance so commit can find it', () => {
      build().onOK();

      expect(dataService.registerInstance).toHaveBeenCalledWith(component.instance!);
    });

    it('stages the new instance', () => {
      build().onOK();

      expect(store.lastAction()!.type).toEqual(NewInstanceActions.register_new_instance.type);
    });

    it('closes with the instance wrapped in a result object', () => {
      // Callers destructure `result.instance`; closing with a bare Instance breaks them.
      build().onOK();

      expect(dialogRef.close).toHaveBeenCalledWith({ instance: component.instance });
    });

    it('closes with an undefined instance when none was created', () => {
      build();
      component.instance = undefined;

      component.onOK();

      expect(dataService.registerInstance).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith({ instance: undefined });
    });
  });

  it('stages nothing when cancelled', () => {
    build().onCancel();

    expect(store.dispatchedActions).toEqual([]);
    expect(dataService.registerInstance).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
