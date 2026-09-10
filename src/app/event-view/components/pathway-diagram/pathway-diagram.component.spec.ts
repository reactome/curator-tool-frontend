// The diagram editor's graph operations run against a live cytoscape instance and are covered
// through diagram-editor.service.spec.ts. This spec covers the component's own state that a
// change can silently break: the lock getters, the undo/redo stacks, the keyboard shortcuts,
// and the popup-menu predicates.
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { QAReportDialogService } from 'src/app/instance/components/qa-report-dialog/qa-report-dialog.service';
import {
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy
} from 'src/testing';
import { PathwayDiagramContentValidator } from './utils/diagram-content-validator.service';
import { DiagramEditorService } from './utils/diagram-editor.service';
import { PathwayDiagramUtilService } from './utils/pathway-diagram-utils';
import { PathwayDiagramComponent } from './pathway-diagram.component';

describe('PathwayDiagramComponent', () => {
  let component: PathwayDiagramComponent;
  let diagramEditor: jasmine.SpyObj<DiagramEditorService>;
  let internals: any;

  beforeEach(() => {
    diagramEditor = jasmine.createSpyObj<DiagramEditorService>('DiagramEditorService', [
      'getCachedDiagramLock', 'isDiagramLockedByMe', 'observeDiagramLocks',
      'observeEditingDiagramUpdates', 'observePathwayDiagramLocksViewModels',
      'lockDiagram', 'unlockDiagram'
    ]);
    diagramEditor.observeDiagramLocks.and.returnValue(of([]) as any);
    diagramEditor.observeEditingDiagramUpdates.and.returnValue(of() as any);
    diagramEditor.getCachedDiagramLock.and.returnValue(null);
    diagramEditor.isDiagramLockedByMe.and.returnValue(false);

    TestBed.configureTestingModule({
      // Standalone component; its own template children are stubbed by NO_ERRORS_SCHEMA.
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        PathwayDiagramComponent,
        // Declared in the component's own `providers`, so instantiating it through TestBed's
        // injector rather than through its template means supplying this here.
        {
          provide: PathwayDiagramUtilService,
          useValue: jasmine.createSpyObj('PathwayDiagramUtilService',
            ['handleInstanceEdit', 'handleInstanceReset', 'select', 'clearSelection',
              'isDbIdInDiagram', 'isDbIdSelected', 'disableAllResizing', 'enableEditing',
              'disableEditing', 'addNewEvent', 'isEventAdded', 'getDataService'])
        },
        { provide: InstanceUtilities, useValue: createInstanceUtilitiesSpy() },
        { provide: DiagramEditorService, useValue: diagramEditor },
        {
          provide: PathwayDiagramContentValidator,
          useValue: jasmine.createSpyObj('PathwayDiagramContentValidator', ['validate'])
        },
        {
          provide: QAReportDialogService,
          useValue: jasmine.createSpyObj('QAReportDialogService', ['openDialog'])
        },
        {
          provide: AuthenticateService,
          useValue: jasmine.createSpyObj('AuthenticateService', ['getUser', 'isAuthenticated'])
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    component = TestBed.inject(PathwayDiagramComponent);
    internals = component as any;
  });

  it('starts not editing and not edited', () => {
    expect(component.isEditing).toBeFalse();
    expect(component.isEdited).toBeFalse();
  });

  it('starts with the popup menu hidden', () => {
    expect(component.showMenu).toBeFalse();
  });

  it('labels itself as a pathway diagram until a pathway is loaded', () => {
    expect(component.diagramLabel).toEqual('Pathway Diagram');
  });

  describe('lock state', () => {
    it('reports the diagram as locked when a lock is cached for it', () => {
      component.pathwayDiagramId = '900';
      diagramEditor.getCachedDiagramLock.and.returnValue({ diagramDbId: 900 } as any);

      expect(component.isDiagramLocked).toBeTrue();
    });

    it('reports it unlocked when no lock is cached', () => {
      component.pathwayDiagramId = '900';
      diagramEditor.getCachedDiagramLock.and.returnValue(null);

      expect(component.isDiagramLocked).toBeFalse();
    });

    it('asks about the diagram it is actually showing', () => {
      component.pathwayDiagramId = '900';

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      component.isDiagramLocked;

      expect(diagramEditor.getCachedDiagramLock).toHaveBeenCalledWith('900' as any);
    });

    it('distinguishes a lock held by this curator', () => {
      // Someone else's lock means read-only; only my own lock enables editing.
      component.pathwayDiagramId = '900';
      diagramEditor.isDiagramLockedByMe.and.returnValue(true);

      expect(component.isLockOwnedByMe).toBeTrue();
    });
  });

  describe('undo and redo', () => {
    it('has nothing to undo or redo to start with', () => {
      expect(component.canUndo).toBeFalse();
      expect(component.canRedo).toBeFalse();
    });

    it('can undo once a snapshot has been taken', () => {
      internals.undoStack.push({ nodes: [] });

      expect(component.canUndo).toBeTrue();
    });

    it('can redo once something has been undone', () => {
      internals.redoStack.push({ nodes: [] });

      expect(component.canRedo).toBeTrue();
    });

    it('does nothing on undo with an empty stack', () => {
      expect(() => component.undo()).not.toThrow();
    });

    it('does nothing on redo with an empty stack', () => {
      expect(() => component.redo()).not.toThrow();
    });

    it('does nothing on undo when there is no live graph', () => {
      internals.undoStack.push({ nodes: [] });

      component.undo();

      // The snapshot is left in place rather than popped against a graph that is not there.
      expect(component.canUndo).toBeTrue();
    });

    it('clears both stacks when the history is reset', () => {
      internals.undoStack.push({ nodes: [] });
      internals.redoStack.push({ nodes: [] });

      internals.clearUndoHistory();

      expect(component.canUndo).toBeFalse();
      expect(component.canRedo).toBeFalse();
    });

    it('caps the undo stack so a long session cannot grow without bound', () => {
      expect(internals.maxUndoStackSize).toEqual(25);
    });

    it('deep-copies a snapshot, so later graph edits cannot mutate history', () => {
      const elements = { nodes: [{ data: { id: 'a' } }] };

      const clone = internals.cloneElements(elements);
      elements.nodes[0].data.id = 'changed';

      expect(clone.nodes[0].data.id).toEqual('a');
    });
  });

  describe('undo/redo keyboard shortcuts', () => {
    function keydown(key: string, modifiers: Partial<KeyboardEventInit> = {}, target?: HTMLElement) {
      const event = new KeyboardEvent('keydown', { key, ...modifiers });
      Object.defineProperty(event, 'target', { value: target ?? document.createElement('div') });
      spyOn(event, 'preventDefault');
      return event;
    }

    beforeEach(() => {
      component.isEditing = true;
      spyOn(component, 'undo');
      spyOn(component, 'redo');
    });

    it('undoes on Ctrl+Z', () => {
      component.handleUndoRedoKeydown(keydown('z', { ctrlKey: true }));

      expect(component.undo).toHaveBeenCalled();
    });

    it('undoes on Cmd+Z, for macOS', () => {
      component.handleUndoRedoKeydown(keydown('z', { metaKey: true }));

      expect(component.undo).toHaveBeenCalled();
    });

    it('redoes on Ctrl+Shift+Z', () => {
      component.handleUndoRedoKeydown(keydown('z', { ctrlKey: true, shiftKey: true }));

      expect(component.redo).toHaveBeenCalled();
      expect(component.undo).not.toHaveBeenCalled();
    });

    it('redoes on Ctrl+Y', () => {
      component.handleUndoRedoKeydown(keydown('y', { ctrlKey: true }));

      expect(component.redo).toHaveBeenCalled();
    });

    it('accepts the shortcut in either case', () => {
      component.handleUndoRedoKeydown(keydown('Z', { ctrlKey: true }));

      expect(component.undo).toHaveBeenCalled();
    });

    it('ignores the key without a modifier', () => {
      component.handleUndoRedoKeydown(keydown('z'));

      expect(component.undo).not.toHaveBeenCalled();
    });

    it('ignores other letters', () => {
      component.handleUndoRedoKeydown(keydown('a', { ctrlKey: true }));

      expect(component.undo).not.toHaveBeenCalled();
    });

    it('does nothing while not editing', () => {
      component.isEditing = false;

      component.handleUndoRedoKeydown(keydown('z', { ctrlKey: true }));

      expect(component.undo).not.toHaveBeenCalled();
    });

    it('leaves the shortcut to a text input the curator is typing in', () => {
      // Ctrl+Z in a text field has to undo the typing, not the diagram.
      component.handleUndoRedoKeydown(
        keydown('z', { ctrlKey: true }, document.createElement('input')));

      expect(component.undo).not.toHaveBeenCalled();
    });

    it('leaves the shortcut to a textarea too', () => {
      component.handleUndoRedoKeydown(
        keydown('z', { ctrlKey: true }, document.createElement('textarea')));

      expect(component.undo).not.toHaveBeenCalled();
    });
  });

  describe('the align action', () => {
    it('needs more than one selected element', () => {
      internals.alignableSelectionCount = 1;

      expect(component.canAlign).toBeFalse();
    });

    it('is available for two or more', () => {
      internals.alignableSelectionCount = 2;

      expect(component.canAlign).toBeTrue();
    });
  });

  describe('resize predicates', () => {
    it('reports nothing resizing without an element under the pointer', () => {
      expect(component.isNodeResizing()).toBeFalse();
      expect(component.isNodeResizable()).toBeFalse();
    });

    it('reports the element under the pointer as resizing when it is', () => {
      const element = { id: 'n1' };
      component.elementUnderMouse = element;
      component.resizingNodes = [element];

      expect(component.isNodeResizing()).toBeTrue();
    });

    it('does not report an unrelated element as resizing', () => {
      component.elementUnderMouse = { id: 'n1' };
      component.resizingNodes = [{ id: 'n2' }];

      expect(component.isNodeResizing()).toBeFalse();
    });

    it('reports no active resize without a live graph', () => {
      expect(component.hasActiveResizing).toBeFalse();
    });
  });

  it('backs up the edited diagram before the tab unloads', () => {
    // Otherwise a reload loses everything drawn since the last upload.
    const backup = spyOn(internals, 'backupEditedDiagram');

    component.handleBeforeUnload();

    expect(backup).toHaveBeenCalled();
  });

  describe('subscriptions', () => {
    it('watches for lock changes made in other tabs', () => {
      component.ngOnInit();

      expect(diagramEditor.observeDiagramLocks).toHaveBeenCalled();
    });

    it('watches for diagram edits broadcast from other tabs', () => {
      component.ngOnInit();

      expect(diagramEditor.observeEditingDiagramUpdates).toHaveBeenCalled();
    });

    it('tears its subscriptions down when destroyed', () => {
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  it('autosaves a backup once a minute', () => {
    expect(internals.backupIntervalMs).toEqual(60 * 1000);
  });
});
