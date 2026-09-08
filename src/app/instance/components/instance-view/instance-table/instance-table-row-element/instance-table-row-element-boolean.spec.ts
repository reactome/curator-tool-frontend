import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { DataService } from '../../../../../core/services/data.service';
import { InstanceUtilities } from '../../../../../core/services/instance.service';
import { DragDropService } from '../../../../../schema-view/instance-bookmark/drag-drop.service';
import { InstanceTableRowElementComponent } from './instance-table-row-element.component';

/**
 * A read-only Boolean row. Material renders a disabled switch grey with the track at 12%
 * opacity, so a checked one looks unchecked and curators read `true` values as `false`
 * (docs/TODO.md). Boolean rows are disabled routinely - NOMANUALEDIT attributes, instances
 * marked for deletion, and every row of the comparison column - so the state has to be
 * readable without relying on the switch's colour. These cases pin the spelled-out value
 * beside the switch, which is what makes it unambiguous; the colour restored in the .scss is
 * an improvement on top of it, not something a unit test can meaningfully assert.
 */
describe('InstanceTableRowElementComponent read-only Boolean value', () => {
  let fixture: ComponentFixture<InstanceTableRowElementComponent>;
  let component: InstanceTableRowElementComponent;

  const booleanAttribute: SchemaAttribute = {
    name: '_doRelease',
    type: AttributeDataType.BOOLEAN,
    cardinality: '1',
    category: AttributeCategory.OPTIONAL,
  } as SchemaAttribute;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InstanceTableRowElementComponent],
      imports: [ReactiveFormsModule, MatSlideToggleModule, RouterTestingModule],
      providers: [
        { provide: Store, useValue: { select: () => of([]), dispatch: () => { } } },
        { provide: DataService, useValue: { setCandidateClasses: () => [] } },
        { provide: InstanceUtilities, useValue: { makeShell: (i: any) => i, setLastClickedDbId: () => { } } },
        { provide: DragDropService, useValue: { register: () => { } } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
        { provide: ActivatedRoute, useValue: { pathFromRoot: [], params: of({}), queryParams: of({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InstanceTableRowElementComponent);
    component = fixture.componentInstance;
    component.attribute = booleanAttribute;
  });

  /** Renders the row with the given value, read-only unless told otherwise. */
  function render(value: any, disabled: boolean = true) {
    component.value = value;
    fixture.detectChanges(); // runs ngOnInit, which pushes the value into the control
    component.disable = disabled;
    fixture.detectChanges();
  }

  function stateLabel(): string | null {
    const label = fixture.nativeElement.querySelector('.boolean-state-label');
    return label ? (label.textContent ?? '').trim() : null;
  }

  function isChecked(): boolean {
    const input = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLElement;
    expect(input).withContext('the Boolean row should render a switch').not.toBeNull();
    return input.getAttribute('aria-checked') === 'true';
  }

  it('spells out a true value that cannot be edited', () => {
    render(true);

    expect(stateLabel()).toBe('true');
    expect(isChecked()).toBeTrue();
  });

  it('spells out a false value that cannot be edited', () => {
    render(false);

    expect(stateLabel()).toBe('false');
    expect(isChecked()).toBeFalse();
  });

  it('says nothing for a Boolean that was never given a value', () => {
    // An unset slot must not read as "false": nothing has been set, and labelling it false
    // would claim an edit the curator never made.
    render(undefined);

    expect(stateLabel()).toBeNull();
    expect(isChecked()).toBeFalse();
  });

  it('leaves an editable row to the switch alone', () => {
    // When the switch can be operated it is coloured and interactive, so the label would only
    // add noise to every editable Boolean row.
    render(true, false);

    expect(stateLabel()).toBeNull();
    expect(isChecked()).toBeTrue();
  });

  it('reports what the switch shows, not its own reading of the value', () => {
    // mat-slide-toggle checks itself on any truthy value, so the non-empty string 'false'
    // renders as checked. The label follows the switch: contradicting it would hide the odd
    // value rather than expose it.
    render('false');

    expect(stateLabel()).toBe('true');
    expect(isChecked()).toBeTrue();
  });
});
