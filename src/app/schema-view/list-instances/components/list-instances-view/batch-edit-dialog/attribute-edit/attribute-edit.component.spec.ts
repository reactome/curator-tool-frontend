import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AttributeValue,
  EDIT_ACTION,
  Instance
} from 'src/app/core/models/reactome-instance.model';
import {
  AttributeCategory,
  AttributeDataType,
  SchemaAttribute
} from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DragDropService } from 'src/app/schema-view/instance-bookmark/drag-drop.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeAttribute,
  makeInstance,
  provideRouteStub
} from 'src/testing';
import { AttributeEditComponent } from './attribute-edit.component';

describe('AttributeEditComponent', () => {
  let component: AttributeEditComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let utils: InstanceUtilitiesSpy;

  function build(attribute: SchemaAttribute | undefined, value: any = '', index = -1) {
    utils = createInstanceUtilitiesSpy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports(), ReactiveFormsModule],
      providers: [
        ...commonTestProviders(),
        AttributeEditComponent,
        provideRouteStub(),
        DragDropService,
        { provide: InstanceUtilities, useValue: utils }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    component = TestBed.inject(AttributeEditComponent);
    component.attribute = attribute;
    component.value = value;
    component.index = index;
    component.ngOnInit();
    return component;
  }

  describe('initialisation', () => {
    it('seeds the control from the bound value', () => {
      build(makeAttribute('definition'), 'The conversion of glucose.');

      expect(component.control.value).toEqual('The conversion of glucose.');
    });

    it('disables the control for a server-managed slot', () => {
      // NOMANUALEDIT slots (created/modified/...) must not be typed into.
      build(makeAttribute('created', { category: AttributeCategory.NOMANUALEDIT }), 'x');

      expect(component.control.disabled).toBeTrue();
    });

    it('leaves an optional slot editable', () => {
      build(makeAttribute('definition'), 'x');

      expect(component.control.enabled).toBeTrue();
    });

    it('attaches the required validator for a required slot', () => {
      build(makeAttribute('name', { category: AttributeCategory.REQUIRED }), '');

      expect(component.control.hasValidator(Validators.required)).toBeTrue();
    });

    it('attaches the required validator for a mandatory slot', () => {
      build(makeAttribute('name', { category: AttributeCategory.MANDATORY }), '');

      expect(component.control.hasValidator(Validators.required)).toBeTrue();
    });

    it('attaches no validator to an optional slot', () => {
      build(makeAttribute('definition'), '');

      expect(component.control.hasValidator(Validators.required)).toBeFalse();
    });

    it('does not yet report an empty required slot as invalid', () => {
      // Documents current behaviour rather than endorsing it. `addValidators` registers the
      // validator but does not re-run validation; Angular requires an explicit
      // `updateValueAndValidity()` for that, and ngOnInit does not call one. So an untouched
      // empty required slot reads as valid and shows no error until the curator edits it.
      // The same omission is in InstanceTableRowElementComponent.
      build(makeAttribute('name', { category: AttributeCategory.REQUIRED }), '');

      expect(component.control.valid).toBeTrue();
      expect(component.control.hasError('required')).toBeFalse();
    });

    it('reports an empty required slot as invalid once validation is re-run', () => {
      build(makeAttribute('name', { category: AttributeCategory.REQUIRED }), '');

      component.control.updateValueAndValidity();

      expect(component.control.hasError('required')).toBeTrue();
    });

    it('exposes the data-type enum for its template', () => {
      build(makeAttribute('definition'));

      expect(component.DATA_TYPES).toBe(AttributeDataType);
    });
  });

  describe('reporting an edit', () => {
    it('emits the new value with the slot index it belongs to', () => {
      // The index matters for a multi-valued slot: without it the wrong occurrence is edited.
      build(makeAttribute('name', { cardinality: '+' }), 'old', 2);
      const emitted: AttributeValue[] = [];
      component.newValueEvent.subscribe(v => emitted.push(v));

      component.control.setValue('new');
      component.onChange();

      expect(emitted.length).toEqual(1);
      expect(emitted[0].value).toEqual('new');
      expect(emitted[0].index).toEqual(2);
    });

    it('stays silent when the value has not actually changed', () => {
      // Blur fires onChange whether or not anything was typed, so this guard is what stops
      // a no-op edit being staged.
      build(makeAttribute('definition'), 'unchanged');
      const emitted: AttributeValue[] = [];
      component.newValueEvent.subscribe(v => emitted.push(v));

      component.onChange();

      expect(emitted).toEqual([]);
    });

    it('emits a boolean change', () => {
      build(makeAttribute('doRelease', { type: AttributeDataType.BOOLEAN }), false);
      const emitted: AttributeValue[] = [];
      component.booleanChange.subscribe(v => emitted.push(v));

      component.control.setValue(true);
      component.onBooleanChange();

      expect(emitted.length).toEqual(1);
      expect(emitted[0].value).toBeTrue();
    });

    it('emits undefined for a boolean the curator cleared', () => {
      // A tri-state boolean slot distinguishes "false" from "not set".
      build(makeAttribute('doRelease', { type: AttributeDataType.BOOLEAN }), false);
      component.isBooleanDisabled = true;
      const emitted: AttributeValue[] = [];
      component.booleanChange.subscribe(v => emitted.push(v));

      component.control.setValue(true);
      component.onBooleanChange();

      expect(emitted[0].value).toBeUndefined();
    });

    it('emits the chosen edit action with the current value and index', () => {
      build(makeAttribute('name', { cardinality: '+' }), 'old', 1);
      const emitted: AttributeValue[] = [];
      component.editAction.subscribe(v => emitted.push(v));

      component.onEditAction(EDIT_ACTION.DELETE);

      expect(emitted.length).toEqual(1);
      expect(emitted[0].editAction).toEqual(EDIT_ACTION.DELETE);
      expect(emitted[0].value).toEqual('old');
      expect(emitted[0].index).toEqual(1);
    });
  });

  describe('keyboard handling', () => {
    /** A textarea standing in for the one the component reads the caret out of. */
    function textarea(value: string, caret: number): HTMLTextAreaElement {
      const el = document.createElement('textarea');
      el.value = value;
      el.selectionStart = caret;
      el.selectionEnd = caret;
      return el;
    }

    function enterOn(el: HTMLTextAreaElement, modifiers: Partial<KeyboardEventInit> = {}) {
      const event = new KeyboardEvent('keydown', { key: 'Enter', ...modifiers });
      Object.defineProperty(event, 'target', { value: el });
      return event;
    }

    it('commits the edit on a plain Enter', () => {
      build(makeAttribute('name'), 'old');
      const emitted: AttributeValue[] = [];
      component.newValueEvent.subscribe(v => emitted.push(v));
      component.control.setValue('new');

      component.onKeyDown(enterOn(textarea('new', 3)));

      expect(emitted.length).toEqual(1);
    });

    it('inserts a newline at the caret on Ctrl+Enter instead of committing', fakeAsync(() => {
      build(makeAttribute('definition'), 'ab');
      const emitted: AttributeValue[] = [];
      component.newValueEvent.subscribe(v => emitted.push(v));
      component.control.setValue('ab');

      component.onKeyDown(enterOn(textarea('ab', 1), { ctrlKey: true }));
      tick();

      expect(component.control.value).toEqual('a\nb');
      expect(emitted).toEqual([]);
    }));

    it('accepts Cmd+Enter as well, for macOS', fakeAsync(() => {
      build(makeAttribute('definition'), 'ab');
      component.control.setValue('ab');

      component.onKeyDown(enterOn(textarea('ab', 2), { metaKey: true }));
      tick();

      expect(component.control.value).toEqual('ab\n');
    }));

    it('ignores keys other than Enter', () => {
      build(makeAttribute('name'), 'old');
      const emitted: AttributeValue[] = [];
      component.newValueEvent.subscribe(v => emitted.push(v));

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'a' }));

      expect(emitted).toEqual([]);
    });
  });

  describe('drag and drop from bookmarks', () => {
    const complex = makeInstance({ dbId: 300, schemaClassName: 'Complex' });

    it('accepts an instance whose class the slot allows', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['Complex', 'SimpleEntity']);

      expect(component.canDrop(complex)).toBeTrue();
    });

    it('refuses an instance whose class the slot does not allow', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['SimpleEntity']);

      expect(component.canDrop(complex)).toBeFalse();
    });

    it('refuses when nothing is being dragged', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));

      expect(component.canDrop(undefined)).toBeFalse();
    });

    it('highlights a droppable slot while a drag is in progress', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['Complex']);

      component.dragDropStatus = { dragging: true, dropping: false, draggedInstance: complex };

      expect(component.dragging).toBeTrue();
      expect(component.isDroppable).toBeTrue();
    });

    it('does not highlight a slot the dragged instance cannot go into', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['SimpleEntity']);

      component.dragDropStatus = { dragging: true, dropping: false, draggedInstance: complex };

      expect(component.isDroppable).toBeFalse();
    });

    it('stages a shell of the dropped instance', () => {
      // Only a shell goes into the slot; keeping the whole instance would duplicate it.
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['Complex']);
      utils.makeShell.and.returnValue({ dbId: 300, schemaClassName: 'Complex' } as any);
      const emitted: AttributeValue[] = [];
      component.editAction.subscribe(v => emitted.push(v));
      component.mouseEnter();

      component.dragDropStatus = { dragging: false, dropping: true, draggedInstance: complex };

      expect(emitted.length).toEqual(1);
      expect(emitted[0].editAction).toEqual(EDIT_ACTION.BOOKMARK);
      expect(utils.makeShell).toHaveBeenCalledWith(complex);
    });

    it('ignores a drop while the pointer is over a different slot', () => {
      // Every slot receives the drop event; only the one under the pointer may take it.
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['Complex']);
      const emitted: AttributeValue[] = [];
      component.editAction.subscribe(v => emitted.push(v));

      component.dragDropStatus = { dragging: false, dropping: true, draggedInstance: complex };

      expect(emitted).toEqual([]);
    });

    it('ignores a drop of a class the slot does not allow', () => {
      build(makeAttribute('hasComponent', { type: AttributeDataType.INSTANCE }));
      dataService.setCandidateClasses.and.returnValue(['SimpleEntity']);
      const emitted: AttributeValue[] = [];
      component.editAction.subscribe(v => emitted.push(v));
      component.mouseEnter();

      component.dragDropStatus = { dragging: false, dropping: true, draggedInstance: complex };

      expect(emitted).toEqual([]);
    });
  });

  describe('the summation text editor button', () => {
    it('appears on hover over an editable Summation text slot', () => {
      build(makeAttribute('text'), 'Some summation.');

      component.mouseEnter();

      expect(component.showEditorButton).toBeTrue();
    });

    it('disappears when the pointer leaves', () => {
      build(makeAttribute('text'), 'Some summation.');
      component.mouseEnter();

      component.mouseLeave();

      expect(component.showEditorButton).toBeFalse();
    });

    it('never appears for a slot that is not the Summation text', () => {
      build(makeAttribute('definition'), 'Some text.');

      component.mouseEnter();

      expect(component.showEditorButton).toBeFalse();
    });

    it('never appears for a read-only text slot', () => {
      build(makeAttribute('text', { category: AttributeCategory.NOMANUALEDIT }), 'x');

      component.mouseEnter();

      expect(component.isSummationText()).toBeFalse();
      expect(component.showEditorButton).toBeFalse();
    });
  });

  describe('links to instance values', () => {
    const pathway = makeInstance({ dbId: 100 });

    it('records the clicked instance so other views can follow it', () => {
      build(makeAttribute('hasEvent', { type: AttributeDataType.INSTANCE }));

      component.onInstanceLinkClicked(pathway);

      expect(utils.setLastClickedDbId).toHaveBeenCalledWith(100);
    });

    it('always links into the schema view', () => {
      build(makeAttribute('hasEvent', { type: AttributeDataType.INSTANCE }));

      expect(component.getInstanceUrlRoot(pathway)).toEqual('/schema_view/instance/100');
    });

    it('gives no link when routing is blocked', () => {
      // Inside a dialog there is nowhere to route to, so the value renders as plain text.
      build(makeAttribute('hasEvent', { type: AttributeDataType.INSTANCE }));
      component.blockRoute = true;

      expect(component.getInstanceUrlRoot(pathway)).toBeUndefined();
    });
  });

  describe('the disable input', () => {
    it('disables the control', () => {
      build(makeAttribute('definition'), 'x');

      component.disable = true;

      expect(component.control.disabled).toBeTrue();
    });

    it('re-enables the control', () => {
      build(makeAttribute('definition'), 'x');
      component.disable = true;

      component.disable = false;

      expect(component.control.enabled).toBeTrue();
    });
  });
});
