import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { componentTestImports, makeInstance, provideDialogContext } from 'src/testing';
import { AttributeListDialogComponent } from './attribute-list-dialog.component';

describe('AttributeListDialogComponent', () => {
  let component: AttributeListDialogComponent;
  let dialogRef: MatDialogRef<AttributeListDialogComponent>;

  const data = { selectedAttribute: 'name', values: ['old text', 'other text'] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        AttributeListDialogComponent,
        ...provideDialogContext(data),
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(AttributeListDialogComponent);
  });

  it('takes the attribute name and its aggregated values from the dialog data', () => {
    expect(component.data.selectedAttribute).toEqual('name');
    expect(component.data.values).toEqual(['old text', 'other text']);
  });

  it('starts with nothing selected', () => {
    expect(component.selectedAttributes).toEqual([]);
  });

  it('adds a ticked value to the selection', () => {
    component.addCheckBox('old text');

    expect(component.selectedAttributes).toEqual(['old text']);
  });

  it('ignores a value that is already selected', () => {
    // Otherwise a re-tick would apply the same batch edit twice.
    component.addCheckBox('old text');
    component.addCheckBox('old text');

    expect(component.selectedAttributes).toEqual(['old text']);
  });

  it('replaces the array on change, so the table picks the update up', () => {
    const before = component.selectedAttributes;

    component.addCheckBox('old text');

    expect(component.selectedAttributes).not.toBe(before);
  });

  it('removes an unticked value from the selection', () => {
    component.addCheckBox('old text');
    component.addCheckBox('other text');

    component.removeCheckBox('old text');

    expect(component.selectedAttributes).toEqual(['other text']);
  });

  it('is a no-op to remove a value that was never selected', () => {
    component.addCheckBox('old text');

    component.removeCheckBox('not selected');

    expect(component.selectedAttributes).toEqual(['old text']);
  });

  it('closes with the chosen values on OK', () => {
    component.addCheckBox('old text');

    component.onOK();

    expect(dialogRef.close).toHaveBeenCalledWith(['old text']);
  });

  it('closes with nothing when cancelled, so no batch edit runs', () => {
    component.addCheckBox('old text');

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  describe('row actions', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    it('opens an instance-valued entry in a new tab', () => {
      const open = spyOn(window, 'open');

      component.handleAction({ instance, action: ACTION_BUTTONS.LAUNCH.name });

      expect(open).toHaveBeenCalledWith('schema_view/instance/100', '_blank');
    });

    it('ticks an unselected entry from the checkbox action', () => {
      component.handleAction({ instance, action: ACTION_BUTTONS.CHECK_BOX.name });

      expect(component.selectedAttributes).toEqual([instance]);
    });

    it('unticks an already-selected entry from the checkbox action', () => {
      component.addCheckBox(instance);

      component.handleAction({ instance, action: ACTION_BUTTONS.CHECK_BOX.name });

      expect(component.selectedAttributes).toEqual([]);
    });

    it('ignores an action it does not handle', () => {
      const open = spyOn(window, 'open');

      component.handleAction({ instance, action: 'delete' });

      expect(open).not.toHaveBeenCalled();
      expect(component.selectedAttributes).toEqual([]);
    });
  });
});
