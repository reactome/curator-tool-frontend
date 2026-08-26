import { CdkMenuModule } from '@angular/cdk/menu';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { DataService } from '../../../../../core/services/data.service';
import { InstanceUtilities } from '../../../../../core/services/instance.service';
import { DragDropService } from '../../../../../schema-view/instance-bookmark/drag-drop.service';
import { ActionMenuComponent } from './action-menu/action-menu.component';
import { InstanceTableRowElementComponent } from './instance-table-row-element.component';

/** Stands in for the real icon, which is only rendered for the hasEvent attribute. */
@Component({ selector: 'class-name-icon', template: '' })
class ClassNameIconStubComponent {
  @Input() className: string | undefined;
}

/**
 * The empty instance slot - what an attribute row becomes once its only value has been
 * deleted. It is the sole way back to a value for that attribute, so the action menu has to
 * be reachable from it.
 *
 * This is a regression guard for a bug the tests never covered. The empty slot is an empty
 * <span>, and with no height of its own it collapsed to nothing: there was no way to
 * right-click it, so deleting the only value of an attribute left a slot that could not be
 * edited again (the "delete this value will disable the action menu popup" TODO of
 * 2024-04-15, fixed in 5c3817ca on 2024-04-23 by giving .span-menu-trigger a height). The
 * height had been commented out once before, and nothing has held it in place since, hence
 * these cases.
 */
describe('InstanceTableRowElementComponent empty instance slot', () => {
  let fixture: ComponentFixture<InstanceTableRowElementComponent>;
  let component: InstanceTableRowElementComponent;
  let overlayContainerElement: HTMLElement;

  const instanceAttribute: SchemaAttribute = {
    name: 'compartment',
    type: AttributeDataType.INSTANCE,
    cardinality: '+',
    category: AttributeCategory.OPTIONAL,
  } as SchemaAttribute;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        InstanceTableRowElementComponent,
        ActionMenuComponent,
        ClassNameIconStubComponent,
      ],
      imports: [
        CdkMenuModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatTooltipModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: Store, useValue: { select: () => of([]), dispatch: () => { } } },
        { provide: DataService, useValue: { setCandidateClasses: () => [] } },
        { provide: InstanceUtilities, useValue: { makeShell: (i: any) => i, setLastClickedDbId: () => { } } },
        { provide: DragDropService, useValue: { register: () => { } } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
        { provide: ActivatedRoute, useValue: { pathFromRoot: [], params: of({}), queryParams: of({}) } },
      ],
    }).compileComponents();

    overlayContainerElement = TestBed.inject(OverlayContainer).getContainerElement();

    fixture = TestBed.createComponent(InstanceTableRowElementComponent);
    component = fixture.componentInstance;
    component.attribute = instanceAttribute;
    component.value = undefined; // the attribute's only value has just been deleted
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  /** The empty slot's right-click target. */
  function emptySlotTarget(): HTMLElement {
    const target = fixture.nativeElement.querySelector('.empty-slot-target');
    expect(target).withContext('the empty slot should render a menu target').not.toBeNull();
    return target as HTMLElement;
  }

  it('renders a right-click target for an attribute with no value', () => {
    expect(emptySlotTarget()).toBeTruthy();
  });

  it('gives the target a hit area to right-click', () => {
    // The bug this pins down: an empty <span> is zero-high, so there is nothing to aim at
    // and the context menu can never be opened on the slot.
    const rect = emptySlotTarget().getBoundingClientRect();

    expect(rect.height).toBeGreaterThan(0);
    expect(rect.width).toBeGreaterThan(0);
  });

  it('opens the action menu on right-click, offering the ways back to a value', () => {
    emptySlotTarget().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    fixture.detectChanges();

    const menuText = overlayContainerElement.textContent ?? '';
    expect(menuText).toContain('Add via Creation');
    expect(menuText).toContain('Add via Selection');
  });

  it('offers Set, not Add, on a single-valued attribute', () => {
    component.attribute = { ...instanceAttribute, cardinality: '1' } as SchemaAttribute;
    fixture.detectChanges();

    emptySlotTarget().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    fixture.detectChanges();

    const menuText = overlayContainerElement.textContent ?? '';
    expect(menuText).toContain('Set via Creation');
    expect(menuText).toContain('Set via Selection');
  });

  it('reveals the edit button while the cursor is in the row, and opens the same menu from it', () => {
    component.mouseEnter();
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector('.add-value-button') as HTMLElement;
    expect(editButton).withContext('hovering the row should reveal the edit button').not.toBeNull();

    editButton.click();
    fixture.detectChanges();

    expect(overlayContainerElement.textContent ?? '').toContain('Add via Creation');
  });

  it('reports the action the curator picked to the table', () => {
    const actions: any[] = [];
    component.editAction.subscribe(action => actions.push(action));
    component.mouseEnter();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.add-value-button') as HTMLElement).click();
    fixture.detectChanges();
    const addViaCreation = Array.from(
      overlayContainerElement.querySelectorAll<HTMLElement>('.action-button')
    ).find(button => (button.textContent ?? '').includes('Add via Creation'));
    expect(addViaCreation).withContext('the menu should offer Add via Creation').toBeTruthy();

    addViaCreation!.click();

    expect(actions.length).toBe(1);
    expect(actions[0].attribute.name).toBe('compartment');
    expect(actions[0].value).toBeUndefined();
  });
});
