import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass,
} from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { DeletionService } from 'src/app/instance/deletion-commit/utils/deletion.service';
import { InstanceEffects } from 'src/app/instance/state/instance.effects';
import {
  defaultPersonReducer,
  deletedInstancesReducer,
  newInstancesReducer,
  updatedInstancesReducer,
} from 'src/app/instance/state/instance.reducers';
import {
  DEFAUT_PERSON_STATE_NAME,
  DELETE_INSTANCES_STATE_NAME,
  NEW_INSTANCES_STATE_NAME,
  UPDATE_INSTANCES_STATE_NAME,
} from 'src/app/instance/state/instance.selectors';
import {
  ActionMenuComponent
} from './instance-table-row-element/action-menu/action-menu.component';
import {
  DisableControlDirective
} from './instance-table-row-element/disableControlDirective';
import {
  InstanceTableRowElementComponent
} from './instance-table-row-element/instance-table-row-element.component';
import { InstanceTableComponent } from './instance-table.component';

function att(name: string, type: AttributeDataType): SchemaAttribute {
  return {
    name,
    type,
    cardinality: '+',
    origin: 'Reaction',
    category: AttributeCategory.OPTIONAL,
    definingType: AttributeDefiningType.NONE_DEFINING,
  };
}

/**
 * An instance with enough attributes, alphabetically straddling "name", that the row for it
 * starts off out of view - so bringing it into view is a real, measurable scroll.
 */
function makeReaction(dbId: number, displayName: string): Instance {
  const attributes: SchemaAttribute[] = [];
  for (let i = 0; i < 20; i++) attributes.push(att('instAtt' + i, AttributeDataType.INSTANCE));
  attributes.push(att('name', AttributeDataType.STRING));
  for (let i = 0; i < 20; i++) attributes.push(att('strAtt' + i, AttributeDataType.STRING));
  const schemaClass: SchemaClass = { name: 'Reaction', attributes };
  const values = new Map<string, any>();
  values.set('displayName', displayName);
  values.set('name', [displayName]);
  for (let i = 0; i < 20; i++) values.set('instAtt' + i, [{ dbId: 1000 + i, schemaClassName: 'Reaction', displayName: 'inst ' + i }]);
  for (let i = 0; i < 20; i++) values.set('strAtt' + i, ['value ' + i]);
  return { dbId, schemaClassName: 'Reaction', displayName, schemaClass, attributes: values, modifiedAttributes: [] };
}

@Component({
  template: `
    <div style="height:320px; overflow:hidden;">
      <app-instance-table [instance]="instance"></app-instance-table>
    </div>`,
})
class HostComponent {
  instance: Instance | undefined;
  @ViewChild(InstanceTableComponent) table!: InstanceTableComponent;
}

/**
 * Mirrors how the new-instance dialog actually embeds this table: .table-container's own
 * max-height is generous enough to fit all the rows (a `calc(100vh - ...)` meant for the
 * full-page view - see instance-table.component.scss), so it never overflows itself; the
 * element that actually clips and scrolls is Material's .mat-mdc-dialog-content further up,
 * stood in for here by .outer-scroller.
 */
@Component({
  template: `
    <div class="outer-scroller" style="height:200px; overflow:auto;">
      <app-instance-table [instance]="instance"></app-instance-table>
    </div>`,
})
class DialogLikeHostComponent {
  instance: Instance | undefined;
  @ViewChild(InstanceTableComponent) table!: InstanceTableComponent;
}

describe('InstanceTableComponent.scrollToAttribute', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let dataService: DataService;
  let reaction: Instance;

  const container = () => fixture.nativeElement.querySelector('.table-container') as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatTableModule, MatTooltipModule, MatIconModule, MatButtonModule, MatCheckboxModule,
        MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatSnackBarModule,
        MatDialogModule, TextFieldModule,
        NgOptimizedImage, CdkMenu, CdkMenuItem, CdkMenuTrigger, CdkContextMenuTrigger,
        CdkDrag, CdkDropList,
        HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule,
        StoreModule.forRoot({}),
        StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
        StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),
        StoreModule.forFeature(DELETE_INSTANCES_STATE_NAME, deletedInstancesReducer),
        StoreModule.forFeature(DEFAUT_PERSON_STATE_NAME, defaultPersonReducer),
        EffectsModule.forRoot([InstanceEffects]),
      ],
      declarations: [
        HostComponent,
        InstanceTableComponent, InstanceTableRowElementComponent, ActionMenuComponent,
        DisableControlDirective,
      ],
      providers: [DeletionService],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    dataService = TestBed.inject(DataService);
    reaction = makeReaction(12345, 'A test reaction');
    dataService.registerInstance(reaction);

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    // Scrolling only actually happens once the element is laid out in the document.
    document.body.appendChild(fixture.nativeElement);
    host.instance = reaction;
    fixture.detectChanges();
    // .table-container's own max-height is `calc(100vh - ...)` (see instance-table.component.scss)
    // - it sizes to content inside a dialog rather than to an ancestor's flex box (that's
    // .fill-height's job, not used here, matching how the new-instance dialog embeds this table).
    // Those custom properties aren't set in this test environment, so pin a concrete height
    // directly instead of depending on undefined custom properties or the test runner's viewport.
    container().style.maxHeight = '300px';
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  it('is out of view before scrolling to it, given how many attributes sort ahead of it', fakeAsync(() => {
    tick();
    flush();
    fixture.detectChanges();

    const el = container();
    const nameRowBefore = el.querySelector('tr[data-attribute="name"]') as HTMLElement;
    expect(nameRowBefore).withContext('the name row should be rendered').toBeTruthy();
    expect(el.scrollTop).toBe(0);
    expect(nameRowBefore.getBoundingClientRect().top)
      .withContext('the name row should start below the visible area')
      .toBeGreaterThan(el.getBoundingClientRect().bottom);
  }));

  it('scrolls the name row into view, below the sticky header', fakeAsync(() => {
    tick();
    flush();
    fixture.detectChanges();

    host.table.scrollToAttribute('name');
    fixture.detectChanges();

    const el = container();
    expect(el.scrollTop).withContext('scrolling to the name row should move the scroll position').toBeGreaterThan(0);

    const nameRow = el.querySelector('tr[data-attribute="name"]') as HTMLElement;
    const header = el.querySelector('tr.mat-mdc-header-row') as HTMLElement;
    const rowRect = nameRow.getBoundingClientRect();
    const containerRect = el.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();

    // Not hidden behind the sticky header...
    expect(rowRect.top).toBeGreaterThanOrEqual(headerRect.bottom - 1);
    // ...and within the visible area of the scrolling container.
    expect(rowRect.bottom).toBeLessThanOrEqual(containerRect.bottom + 1);
  }));

  it('does nothing if there is no row for the given attribute', fakeAsync(() => {
    tick();
    flush();
    fixture.detectChanges();

    host.table.scrollToAttribute('doesNotExist');
    fixture.detectChanges();

    expect(container().scrollTop).toBe(0);
  }));
});

describe('InstanceTableComponent.scrollToAttribute when embedded in a dialog', () => {
  let fixture: ComponentFixture<DialogLikeHostComponent>;
  let host: DialogLikeHostComponent;
  let dataService: DataService;
  let reaction: Instance;

  const outerScroller = () => fixture.nativeElement.querySelector('.outer-scroller') as HTMLElement;
  const tableContainer = () => fixture.nativeElement.querySelector('.table-container') as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatTableModule, MatTooltipModule, MatIconModule, MatButtonModule, MatCheckboxModule,
        MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatSnackBarModule,
        MatDialogModule, TextFieldModule,
        NgOptimizedImage, CdkMenu, CdkMenuItem, CdkMenuTrigger, CdkContextMenuTrigger,
        CdkDrag, CdkDropList,
        HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule,
        StoreModule.forRoot({}),
        StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
        StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),
        StoreModule.forFeature(DELETE_INSTANCES_STATE_NAME, deletedInstancesReducer),
        StoreModule.forFeature(DEFAUT_PERSON_STATE_NAME, defaultPersonReducer),
        EffectsModule.forRoot([InstanceEffects]),
      ],
      declarations: [
        DialogLikeHostComponent,
        InstanceTableComponent, InstanceTableRowElementComponent, ActionMenuComponent,
        DisableControlDirective,
      ],
      providers: [DeletionService],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    dataService = TestBed.inject(DataService);
    reaction = makeReaction(54321, 'A test reaction');
    dataService.registerInstance(reaction);

    fixture = TestBed.createComponent(DialogLikeHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    host.instance = reaction;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  it("scrolls the outer dialog-like ancestor, since .table-container itself doesn't overflow here", fakeAsync(() => {
    tick();
    flush();
    fixture.detectChanges();

    // .table-container's own max-height comfortably fits every row - nothing to scroll there.
    expect(tableContainer().scrollHeight).toBeLessThanOrEqual(tableContainer().clientHeight + 1);
    expect(outerScroller().scrollTop).toBe(0);

    host.table.scrollToAttribute('name');
    fixture.detectChanges();

    expect(outerScroller().scrollTop)
      .withContext('the outer scrollable ancestor should have moved instead')
      .toBeGreaterThan(0);

    const nameRow = fixture.nativeElement.querySelector('tr[data-attribute="name"]') as HTMLElement;
    const outerRect = outerScroller().getBoundingClientRect();
    const rowRect = nameRow.getBoundingClientRect();
    expect(rowRect.top).toBeGreaterThanOrEqual(outerRect.top - 1);
    expect(rowRect.bottom).toBeLessThanOrEqual(outerRect.bottom + 1);
  }));
});
