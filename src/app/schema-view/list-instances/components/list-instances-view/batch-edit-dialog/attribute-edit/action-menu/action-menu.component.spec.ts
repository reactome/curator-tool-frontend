import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EDIT_ACTION } from 'src/app/core/models/reactome-instance.model';
import { componentTestImports } from 'src/testing';
import { EditMenuComponent } from './action-menu.component';

describe('EditMenuComponent', () => {
  let component: EditMenuComponent;
  let fixture: ComponentFixture<EditMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [EditMenuComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(EditMenuComponent);
    component = fixture.componentInstance;
  });

  it('assumes a multi-valued, non-instance slot until told otherwise', () => {
    expect(component.isSingledValued).toBeFalse();
    expect(component.isInstanceType).toBeFalse();
  });

  it('exposes the EDIT_ACTION enum for its template to switch on', () => {
    expect(component.EDIT_ACTION).toBe(EDIT_ACTION);
  });

  it('emits the chosen action to the batch-edit dialog', () => {
    const emitted: EDIT_ACTION[] = [];
    component.actionItem.subscribe(a => emitted.push(a));

    component.onClick(EDIT_ACTION.REPLACE_VIA_SELECT);

    expect(emitted).toEqual([EDIT_ACTION.REPLACE_VIA_SELECT]);
  });

  it('remembers the chosen action so the template can mark it active', () => {
    expect(component.selectedAction).toBeUndefined();

    component.onClick(EDIT_ACTION.DELETE);

    expect(component.selectedAction).toEqual(EDIT_ACTION.DELETE);
  });

  it('keeps the panel open after a choice, unlike the row-level action menu', () => {
    // Batch editing continues in this panel after the action is picked -- the value to apply
    // is still to be entered -- so it must not hide itself.
    component.onClick(EDIT_ACTION.ADD_NEW);

    expect(component.hidePanel).toBeFalse();
  });

  it('replaces the remembered action when a different one is chosen', () => {
    component.onClick(EDIT_ACTION.ADD_NEW);
    component.onClick(EDIT_ACTION.DELETE);

    expect(component.selectedAction).toEqual(EDIT_ACTION.DELETE);
  });
});
