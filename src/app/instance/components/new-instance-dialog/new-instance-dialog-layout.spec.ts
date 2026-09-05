import { OverlayContainer } from '@angular/cdk/overlay';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ApplicationRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { of } from 'rxjs';
import { AttributeValue, EDIT_ACTION, Instance } from 'src/app/core/models/reactome-instance.model';
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
} from '../instance-view/instance-table/instance-table-row-element/action-menu/action-menu.component';
import {
  DisableControlDirective
} from '../instance-view/instance-table/instance-table-row-element/disableControlDirective';
import {
  InstanceTableRowElementComponent
} from '../instance-view/instance-table/instance-table-row-element/instance-table-row-element.component';
import { InstanceTableComponent } from '../instance-view/instance-table/instance-table.component';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';

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

/** A class with enough attributes, alphabetically straddling "name", that scrolling to it is real. */
function makeReaction(dbId: number): Instance {
  const attributes: SchemaAttribute[] = [];
  for (let i = 0; i < 20; i++) attributes.push(att('instAtt' + i, AttributeDataType.INSTANCE));
  attributes.push(att('name', AttributeDataType.STRING));
  for (let i = 0; i < 20; i++) attributes.push(att('strAtt' + i, AttributeDataType.STRING));
  const schemaClass: SchemaClass = { name: 'Reaction', attributes };
  return {
    dbId,
    schemaClassName: 'Reaction',
    displayName: '(new instance)',
    schemaClass,
    attributes: new Map(),
    modifiedAttributes: [],
  };
}

/**
 * Opens the real dialog through MatDialog (so the real .mdc-dialog__* CSS, the real open
 * animation, and BrowserAnimationsModule all apply - not NoopAnimationsModule) to measure the
 * two visual bugs reported against it: too much air between the title and the class picker, and
 * the auto-scrolled name row landing with its top clipped by the sticky header.
 */
describe('NewInstanceDialogComponent layout, opened through MatDialog with real animations', () => {
  let overlayContainerElement: HTMLElement;
  let dataService: DataService;
  const reaction = makeReaction(-1);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatTableModule, MatTooltipModule, MatIconModule, MatButtonModule, MatCheckboxModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatSnackBarModule,
        MatDialogModule, TextFieldModule,
        NgOptimizedImage, CdkMenu, CdkMenuItem, CdkMenuTrigger, CdkContextMenuTrigger,
        CdkDrag, CdkDropList,
        HttpClientTestingModule, BrowserAnimationsModule, RouterTestingModule,
        StoreModule.forRoot({}),
        StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
        StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),
        StoreModule.forFeature(DELETE_INSTANCES_STATE_NAME, deletedInstancesReducer),
        StoreModule.forFeature(DEFAUT_PERSON_STATE_NAME, defaultPersonReducer),
        EffectsModule.forRoot([InstanceEffects]),
      ],
      declarations: [
        NewInstanceDialogComponent,
        InstanceTableComponent, InstanceTableRowElementComponent, ActionMenuComponent,
        DisableControlDirective,
      ],
      providers: [DeletionService],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    dataService = TestBed.inject(DataService);
    spyOn(dataService, 'setCandidateClasses').and.returnValue(['Reaction']);
    spyOn(dataService, 'createNewInstance').and.returnValue(of(reaction));

    overlayContainerElement = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
  });

  /**
   * MatDialog attaches its content via ApplicationRef.attachView() rather than as a child of any
   * fixture this test controls, so nothing drives change detection for it unless something ticks
   * ApplicationRef directly - without this, the dialog's own title/field render (from bindings
   * available synchronously in the constructor) but the table never does, since building its ~40
   * rows depends on a later, separately-timed binding update.
   */
  function openDialog() {
    const data: AttributeValue = { attribute: {} as SchemaAttribute, value: undefined, editAction: EDIT_ACTION.ADD_NEW };
    const ref = TestBed.inject(MatDialog).open(NewInstanceDialogComponent, { width: '1000px', height: '500px', data });
    TestBed.inject(ApplicationRef).tick();
    return ref;
  }

  it('keeps a small, deliberate gap between the title and the schema-class field', fakeAsync(() => {
    openDialog();
    tick(500); // let the open animation and the post-open scroll chain both settle
    flush();

    const title = overlayContainerElement.querySelector('.dialog_title') as HTMLElement;
    const field = overlayContainerElement.querySelector('.class-select-field') as HTMLElement;
    expect(title).withContext('the dialog title should be rendered').toBeTruthy();
    expect(field).withContext('the class-select field should be rendered').toBeTruthy();

    const gap = field.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
    // Enough room for the outlined field's floating label to sit in without being clipped by
    // .mat-mdc-dialog-content's overflow: hidden (see the comment in the component's scss), but
    // not the dialog's full default top padding, which read as a lot of empty air under the title.
    expect(gap).withContext(`title-to-field gap was ${gap}px`).toBeLessThan(30);
    expect(gap).withContext(`title-to-field gap was ${gap}px`).toBeGreaterThan(0);
  }));

  it('scrolls the name row fully below the sticky header once the dialog has finished opening', fakeAsync(() => {
    openDialog();
    tick(500); // let the open animation finish, then the deferred scroll-to-name run
    flush();

    const nameRow = overlayContainerElement.querySelector('tr[data-attribute="name"]') as HTMLElement;
    const header = overlayContainerElement.querySelector('tr.mat-mdc-header-row') as HTMLElement;
    expect(nameRow).withContext('the name row should be rendered').toBeTruthy();
    expect(header).withContext('the sticky header row should be rendered').toBeTruthy();

    const rowTop = nameRow.getBoundingClientRect().top;
    const headerBottom = header.getBoundingClientRect().bottom;
    expect(rowTop)
      .withContext(`name row top (${rowTop}) should be at or below the sticky header's bottom (${headerBottom})`)
      .toBeGreaterThanOrEqual(headerBottom - 1);
  }));
});
