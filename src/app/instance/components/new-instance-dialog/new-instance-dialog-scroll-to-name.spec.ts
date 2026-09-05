import { fakeAsync, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass,
} from 'src/app/core/models/reactome-schema.model';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';

/**
 * Covers the decision logic in NewInstanceDialogComponent.scrollToNameIfPresent(): which classes
 * trigger a scroll to the name row, that it waits for both the instance to load and the dialog's
 * own open animation to finish (whichever happens last), and that it's deferred a further tick
 * so the table has rendered the row for the newly-bound instance first. The scroll math itself
 * (accounting for the sticky header, actually moving the table's scroll position) is covered
 * separately, in a real browser, by instance-table-scroll-to-attribute.spec.ts -
 * InstanceTableComponent is stubbed out here so this can instead focus on the wiring, without
 * pulling in the table's own template and all of its transitive Material/CDK dependencies just
 * to construct this dialog.
 */
describe('NewInstanceDialogComponent auto-scroll to the name row', () => {
  let dataService: jasmine.SpyObj<{ setCandidateClasses: (...args: any[]) => string[], createNewInstance: (...args: any[]) => any }>;
  let dialogRef: jasmine.SpyObj<{ close: (...args: any[]) => void, afterOpened: (...args: any[]) => any }>;
  let instanceTable: jasmine.SpyObj<{ scrollToAttribute: (name: string) => void }>;

  function schemaClass(className: string, attributeNames: string[]): SchemaClass {
    const attributes: SchemaAttribute[] = attributeNames.map(name => ({
      name,
      type: AttributeDataType.STRING,
      cardinality: '+',
      origin: className,
      category: AttributeCategory.OPTIONAL,
      definingType: AttributeDefiningType.NONE_DEFINING,
    }));
    return { name: className, attributes };
  }

  function instanceOfClass(dbId: number, className: string, attributeNames: string[]): Instance {
    return {
      dbId,
      schemaClassName: className,
      displayName: className,
      schemaClass: schemaClass(className, attributeNames),
      attributes: new Map(),
      modifiedAttributes: [],
    };
  }

  const withName = instanceOfClass(1, 'WithName', ['summation', 'name', 'compartment']);
  const withoutName = instanceOfClass(2, 'WithoutName', ['summation', 'compartment']);

  beforeEach(() => {
    dataService = jasmine.createSpyObj('DataService', ['setCandidateClasses', 'createNewInstance']);
    dataService.setCandidateClasses.and.returnValue(['WithName', 'WithoutName']);
    dataService.createNewInstance.and.returnValue(of(withName));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close', 'afterOpened']);
    // Already open by default, so the existing tests (which don't care about this) don't have
    // to know about it; the tests that do care override this per-test.
    dialogRef.afterOpened.and.returnValue(of(undefined));
    instanceTable = jasmine.createSpyObj('InstanceTableComponent', ['scrollToAttribute']);
  });

  // Bypasses Angular's DI/view resolution on purpose (see the class doc above): @ViewChild only
  // ever populates through a real view, which this test deliberately doesn't render.
  function createComponent(): NewInstanceDialogComponent {
    const component = new NewInstanceDialogComponent(
      { attribute: {} } as any, dialogRef as any, dataService as any, {} as any);
    (component as any).instanceTable = instanceTable;
    return component;
  }

  it('scrolls to the name row once a class with a name attribute loads', fakeAsync(() => {
    createComponent();
    tick();
    expect(instanceTable.scrollToAttribute).toHaveBeenCalledWith('name');
  }));

  it('does not try to scroll for a class with no name attribute', fakeAsync(() => {
    dataService.createNewInstance.and.returnValue(of(withoutName));
    createComponent();
    tick();
    expect(instanceTable.scrollToAttribute).not.toHaveBeenCalled();
  }));

  it('re-triggers (or not) when the selected class changes', fakeAsync(() => {
    const component = createComponent();
    tick();
    instanceTable.scrollToAttribute.calls.reset();

    dataService.createNewInstance.and.returnValue(of(withoutName));
    component.selected = 'WithoutName';
    component.onSelectionChange();
    tick();
    expect(instanceTable.scrollToAttribute).not.toHaveBeenCalled();

    dataService.createNewInstance.and.returnValue(of(withName));
    component.selected = 'WithName';
    component.onSelectionChange();
    tick();
    expect(instanceTable.scrollToAttribute).toHaveBeenCalledWith('name');
  }));

  // The bug this covers: scrolling as soon as the instance loaded, without waiting for the
  // dialog's own open (enter) animation to finish, measured the row's position against the
  // dialog's still-mid-animation (transform: scale()'d down) layout - close enough to look
  // deliberate, but consistently a little off, so the name row's top ended up clipped by the
  // sticky header once the animation actually settled.
  it('does not scroll until the dialog has finished its own open animation', fakeAsync(() => {
    const opened = new Subject<void>();
    dialogRef.afterOpened.and.returnValue(opened);

    createComponent();
    tick();
    expect(instanceTable.scrollToAttribute)
      .withContext('the instance loaded, but the dialog has not finished opening yet')
      .not.toHaveBeenCalled();

    opened.next();
    tick();
    expect(instanceTable.scrollToAttribute).toHaveBeenCalledWith('name');
  }));

  // Covers the other ordering: the dialog can finish opening before createNewInstance's
  // response comes back (a slower request, or a faster animation).
  it('scrolls once the instance loads, if the dialog had already finished opening', fakeAsync(() => {
    const instanceLoaded = new Subject<Instance>();
    dataService.createNewInstance.and.returnValue(instanceLoaded);

    createComponent();
    tick();
    expect(instanceTable.scrollToAttribute)
      .withContext('the dialog is open, but the instance has not loaded yet')
      .not.toHaveBeenCalled();

    instanceLoaded.next(withName);
    tick();
    expect(instanceTable.scrollToAttribute).toHaveBeenCalledWith('name');
  }));
});
