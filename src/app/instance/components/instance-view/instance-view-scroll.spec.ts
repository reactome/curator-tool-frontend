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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { delay, of } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass,
} from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { ClassNameIconComponent } from 'src/app/event-view/components/event-tree/class-name-icon/class-name-icon.component';
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
import { BreadCrumbComponent } from './bread-crumb/bread-crumb.component';
import {
  ActionMenuComponent
} from './instance-table/instance-table-row-element/action-menu/action-menu.component';
import {
  DisableControlDirective
} from './instance-table/instance-table-row-element/disableControlDirective';
import {
  InstanceTableRowElementComponent
} from './instance-table/instance-table-row-element/instance-table-row-element.component';
import { InstanceTableComponent } from './instance-table/instance-table.component';
import { InstanceViewComponent } from './instance-view.component';
import { QAReportsActionMenuComponent } from './qa-reports-action-menu/qa-reports-action-menu.component';

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
 * An instance with enough attributes that its table has to scroll, so that a lost scroll
 * position is measurable.
 */
function makeReaction(dbId: number, displayName: string): Instance {
  const attributes: SchemaAttribute[] = [];
  for (let i = 0; i < 20; i++) attributes.push(att('strAtt' + i, AttributeDataType.STRING));
  for (let i = 0; i < 20; i++) attributes.push(att('instAtt' + i, AttributeDataType.INSTANCE));
  attributes.push(att('name', AttributeDataType.STRING));
  attributes.push(att('species', AttributeDataType.INSTANCE));
  const schemaClass: SchemaClass = { name: 'Reaction', attributes };
  const values = new Map<string, any>();
  values.set('displayName', displayName);
  values.set('name', [displayName]);
  for (let i = 0; i < 20; i++) values.set('strAtt' + i, ['value ' + i]);
  for (let i = 0; i < 20; i++)
    values.set('instAtt' + i, [{ dbId: 1000 + i, schemaClassName: 'Reaction', displayName: 'inst ' + i }]);
  values.set('species', [{ dbId: 48887, schemaClassName: 'Species', displayName: 'Homo sapiens' }]);
  return { dbId, schemaClassName: 'Reaction', displayName, schemaClass, attributes: values, modifiedAttributes: [] };
}

@Component({
  template: `
    <div style="height:320px; overflow:hidden;">
      <app-instance-view [isInEventView]="true" [needHistory]="true" [blockRoute]="true"></app-instance-view>
    </div>`,
})
class HostComponent {
  @ViewChild(InstanceViewComponent) view!: InstanceViewComponent;
}

describe('InstanceViewComponent scroll position', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let dataService: DataService;
  let reaction: Instance;

  /** The element that actually scrolls; absent while the table is unmounted. */
  const scroller = () => fixture.nativeElement.querySelector('.table-container') as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatTableModule, MatTooltipModule, MatIconModule, MatButtonModule, MatCheckboxModule,
        MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatSnackBarModule,
        MatDialogModule, MatToolbarModule, MatProgressSpinnerModule, TextFieldModule,
        NgOptimizedImage, CdkMenu, CdkMenuItem, CdkMenuTrigger, CdkContextMenuTrigger,
        CdkDrag, CdkDropList, ClassNameIconComponent,
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
        InstanceViewComponent, BreadCrumbComponent, QAReportsActionMenuComponent,
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
    // The table only scrolls once it is laid out, so the fixture has to be in the document.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  /** Show `reaction` and scroll its attribute table to the bottom. Returns the scrolled element. */
  function showReactionScrolledToBottom(): HTMLElement {
    host.view.loadInstance(reaction.dbId);
    tick(50);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const el = scroller()!;
    expect(el).withContext('the attribute table should be rendered').toBeTruthy();
    el.scrollTop = el.scrollHeight - el.clientHeight;
    expect(el.scrollTop).withContext('the attribute table should be scrollable').toBeGreaterThan(0);
    return el;
  }

  it('keeps the attribute table scrolled where it was when the instance on display is refreshed',
    fakeAsync(() => {
      const el = showReactionScrolledToBottom();
      const before = el.scrollTop;

      // Post-edit notifications refresh the instance already on display (see the refreshViewDbId$
      // and lastUpdatedInstance$ handlers). Make the re-fetch take a tick, as it does whenever the
      // instance is not served straight from the cache, so that Angular renders the state in
      // between: that is when the spinner used to *ngIf the table - the scrolling element - away.
      spyOn(dataService, 'fetchInstance').and.returnValue(of(reaction).pipe(delay(1)));

      host.view.loadInstance(reaction.dbId, false, false, true);
      tick(0); // loadInstance's setTimeout has run; the re-fetch is still in flight
      fixture.detectChanges();
      expect(host.view.showProgressSpinner)
        .withContext('a refresh in place must not raise the spinner').toBeFalse();
      expect(scroller()).withContext('the attribute table must stay mounted').toBe(el);

      flush();
      tick(50);
      fixture.detectChanges();

      expect(scroller()).toBe(el);
      expect(el.scrollTop).toBe(before);
    }));

  it('restores the scroll position after an edit rebuilds the rows', fakeAsync(() => {
    const el = showReactionScrolledToBottom();
    const table = host.view.instanceTable;
    const before = el.scrollTop;

    reaction.attributes.get('species').push({ dbId: 48895, schemaClassName: 'Species', displayName: 'Mus musculus' });
    table.finishEdit('species', undefined);
    fixture.detectChanges();
    // updateTableContent() saves the pre-edit scroll position and restores it in a setTimeout,
    // once CdkTable has re-created the rows and the browser has settled the layout that clamps
    // scrollTop to 0 in the meantime.
    flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('Mus musculus');
    expect(el.scrollTop).toBe(before);
  }));

  it('shows a different instance from the top', fakeAsync(() => {
    const el = showReactionScrolledToBottom();

    const other = makeReaction(67890, 'Another test reaction');
    other.attributes.set('instAtt0', [{ dbId: 9999, schemaClassName: 'Reaction', displayName: 'a different value' }]);
    host.view.instance = other;
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    // A switch to a different instance is not a reload of the table already on display, so the
    // scroll position is not restored - it is left at the top, where the row rebuild's layout
    // clamp put it.
    expect(el.scrollTop).toBe(0);
    expect(el.textContent).toContain('a different value');
  }));

  it('still covers a switch to another instance with the spinner', fakeAsync(() => {
    showReactionScrolledToBottom();
    const other = makeReaction(67890, 'Another test reaction');
    dataService.registerInstance(other);
    spyOn(dataService, 'fetchInstance').and.returnValue(of(other).pipe(delay(1)));

    host.view.loadInstance(other.dbId);
    tick(0);
    fixture.detectChanges();
    expect(host.view.showProgressSpinner).toBeTrue();

    flush();
    tick(50);
    fixture.detectChanges();
    expect(host.view.showProgressSpinner).toBeFalse();
    expect(host.view.instance?.dbId).toBe(other.dbId);
    // A different instance starts at the top, which is what is wanted for a switch.
    expect(scroller()!.scrollTop).toBe(0);
  }));
});
