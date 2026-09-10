import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import { EDIT_ACTION } from '../../instance-table-comparison.model';
import { ActionMenuComponent } from './action-menu.component';

describe('ActionMenuComponent', () => {
  let component: ActionMenuComponent;
  let fixture: ComponentFixture<ActionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [ActionMenuComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ActionMenuComponent);
    component = fixture.componentInstance;
  });

  it('treats a slot as multi-valued and non-stoichiometric by default', () => {
    expect(component.isSingledValued).toBeFalse();
    expect(component.canEditStoichiometry).toBeFalse();
    expect(component.canShowReferrers).toBeFalse();
  });

  it('exposes the EDIT_ACTION enum to its template', () => {
    // The template switches on these, so losing the reference silently breaks every menu item.
    expect(component.EDIT_ACTION).toBe(EDIT_ACTION);
  });

  it('emits the chosen action for the parent row to carry out', () => {
    const emitted: EDIT_ACTION[] = [];
    component.actionItem.subscribe(a => emitted.push(a));

    component.onClick(EDIT_ACTION.ADD_VIA_SELECT);

    expect(emitted).toEqual([EDIT_ACTION.ADD_VIA_SELECT]);
  });

  it('emits each distinct action it is given', () => {
    const emitted: EDIT_ACTION[] = [];
    component.actionItem.subscribe(a => emitted.push(a));

    component.onClick(EDIT_ACTION.ADD_NEW);
    component.onClick(EDIT_ACTION.DELETE);
    component.onClick(EDIT_ACTION.SHOW_REFERRERS);

    expect(emitted).toEqual([
      EDIT_ACTION.ADD_NEW, EDIT_ACTION.DELETE, EDIT_ACTION.SHOW_REFERRERS
    ]);
  });

  it('closes the panel after an action is chosen', () => {
    expect(component.hidePanel).toBeFalse();

    component.onClick(EDIT_ACTION.EDIT);

    expect(component.hidePanel).toBeTrue();
  });
});
