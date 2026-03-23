import { of } from 'rxjs';
import { AttributeValue, EDIT_ACTION, Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeDataType, AttributeDefiningType, AttributeCategory, SchemaAttribute, SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { NewInstanceDialogService } from 'src/app/instance/components/new-instance-dialog/new-instance-dialog.service';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { AttributeListDialogService } from './attribute-list-dialog/attribute-list-dialog.service';
import { SelectInstanceDialogService } from '../../select-instance-dialog/select-instance-dialog.service';
import { BatchEditDialogComponent } from './batch-edit-dialog.component';

describe('BatchEditDialogComponent', () => {
  const textAttribute: SchemaAttribute = {
    name: 'name',
    cardinality: '+',
    origin: 'TestClass',
    category: AttributeCategory.OPTIONAL,
    definingType: AttributeDefiningType.NONE_DEFINING,
    type: AttributeDataType.STRING,
  };

  const instanceAttribute: SchemaAttribute = {
    name: 'referenceEntity',
    cardinality: '1',
    origin: 'TestClass',
    category: AttributeCategory.OPTIONAL,
    definingType: AttributeDefiningType.NONE_DEFINING,
    type: AttributeDataType.INSTANCE,
  };

  const schemaClass: SchemaClass = {
    name: 'TestClass',
    attributes: [textAttribute, instanceAttribute],
  };

  let dataService: jasmine.SpyObj<DataService>;
  let newInstanceDialogService: jasmine.SpyObj<NewInstanceDialogService>;
  let selectInstanceDialogService: jasmine.SpyObj<SelectInstanceDialogService>;
  let attributeEditService: jasmine.SpyObj<AttributeEditService>;
  let postEditService: jasmine.SpyObj<PostEditService>;
  let instUtil: jasmine.SpyObj<InstanceUtilities>;
  let attributeListDialogService: jasmine.SpyObj<AttributeListDialogService>;
  let dialogRef: { close: jasmine.Spy };

  function makeInstance(dbId: number, attributes: Map<string, any>): Instance {
    return {
      dbId,
      schemaClassName: 'TestClass',
      displayName: `Instance ${dbId}`,
      attributes,
    };
  }

  function createComponent(data: Instance[]): BatchEditDialogComponent {
    dataService.fetchSchemaClass.and.returnValue(of(schemaClass));
    return new BatchEditDialogComponent(
      data,
      dialogRef as any,
      dataService,
      newInstanceDialogService,
      selectInstanceDialogService,
      attributeEditService,
      postEditService,
      instUtil,
      attributeListDialogService,
    );
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', ['fetchSchemaClass', 'fetchInstanceInBatch']);
    newInstanceDialogService = jasmine.createSpyObj<NewInstanceDialogService>('NewInstanceDialogService', ['openDialog']);
    selectInstanceDialogService = jasmine.createSpyObj<SelectInstanceDialogService>('SelectInstanceDialogService', ['openDialog']);
    attributeEditService = jasmine.createSpyObj<AttributeEditService>('AttributeEditService', [
      'addValueToAttribute',
      'addInstanceViaSelect',
      'onNoInstanceAttributeEdit',
      'deleteInstanceAttribute',
    ]);
    postEditService = jasmine.createSpyObj<PostEditService>('PostEditService', ['postEdit']);
    instUtil = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities', ['addToModifiedAttributes', 'registerUpdatedInstance']);
    attributeListDialogService = jasmine.createSpyObj<AttributeListDialogService>('AttributeListDialogService', ['openDialog']);
    dialogRef = { close: jasmine.createSpy('close') };
  });

  it('replaces selected text values across matching instances', () => {
    const instance1 = makeInstance(1, new Map<string, any>([['name', ['old text', 'keep me']]]));
    const instance2 = makeInstance(2, new Map<string, any>([['name', ['different text']]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = textAttribute;
    component.storeAggregatedAttributes = new Set(['old text', 'different text']);
    dataService.fetchInstanceInBatch.and.returnValue(of([instance1, instance2]));
    attributeListDialogService.openDialog.and.returnValue({ afterClosed: () => of(['old text']) } as any);

    component.onSelectTextAction(EDIT_ACTION.REPLACE_NEW);
    component.onEditAction({ attribute: textAttribute, value: 'new text' });

    expect(attributeListDialogService.openDialog).toHaveBeenCalledWith('name', ['old text', 'different text']);
    expect(attributeEditService.onNoInstanceAttributeEdit).toHaveBeenCalledTimes(1);
    const [replaceValue, replacementText, editedInstance, replaceFlag] = attributeEditService.onNoInstanceAttributeEdit.calls.mostRecent().args;
    expect((replaceValue as AttributeValue).value).toBe('old text');
    expect(replacementText).toBe('new text');
    expect(editedInstance).toBe(instance1);
    expect(replaceFlag).toBeTrue();
    expect(instUtil.addToModifiedAttributes).toHaveBeenCalledWith('name', instance1);
    expect(instUtil.registerUpdatedInstance).toHaveBeenCalledWith('name', instance1);
  });

  it('deletes only the selected text values from matching instances', () => {
    const instance1 = makeInstance(1, new Map<string, any>([['name', ['obsolete', 'keep me']]]));
    const instance2 = makeInstance(2, new Map<string, any>([['name', ['different text']]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = textAttribute;
    component.storeAggregatedAttributes = new Set(['obsolete', 'different text']);
    dataService.fetchInstanceInBatch.and.returnValue(of([instance1, instance2]));
    attributeListDialogService.openDialog.and.returnValue({ afterClosed: () => of(['obsolete']) } as any);

    component.onSelectTextAction(EDIT_ACTION.DELETE);

    expect(component.selectedAction).toBe(EDIT_ACTION.DELETE);
    expect(attributeEditService.onNoInstanceAttributeEdit).toHaveBeenCalledTimes(1);
    const [deleteValue, deletionMarker, editedInstance, replaceFlag] = attributeEditService.onNoInstanceAttributeEdit.calls.mostRecent().args;
    expect((deleteValue as AttributeValue).value).toBe('obsolete');
    expect(deletionMarker).toBe('');
    expect(editedInstance).toBe(instance1);
    expect(replaceFlag).toBeTrue();
    expect(instUtil.addToModifiedAttributes).toHaveBeenCalledWith('name', instance1);
    expect(instUtil.registerUpdatedInstance).toHaveBeenCalledWith('name', instance1);
  });

  it('replaces a selected single-valued instance attribute via creation', () => {
    const oldReference = { dbId: 100, schemaClassName: 'ReferenceEntity', displayName: 'Old Ref' } as Instance;
    const otherReference = { dbId: 101, schemaClassName: 'ReferenceEntity', displayName: 'Other Ref' } as Instance;
    const createdReference = { dbId: -1, schemaClassName: 'ReferenceEntity', displayName: 'Created Ref' } as Instance;
    const instance1 = makeInstance(1, new Map<string, any>([['referenceEntity', oldReference]]));
    const instance2 = makeInstance(2, new Map<string, any>([['referenceEntity', otherReference]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = instanceAttribute;
    component.storeAggregatedAttributes = new Set([oldReference, otherReference]);
    dataService.fetchInstanceInBatch.and.returnValue(of([instance1, instance2]));
    attributeListDialogService.openDialog.and.returnValue({ afterClosed: () => of([oldReference]) } as any);
    newInstanceDialogService.openDialog.and.returnValue({ afterClosed: () => of(createdReference) } as any);

    component.onInstanceAttributeEdit({
      attribute: instanceAttribute,
      value: undefined,
      editAction: EDIT_ACTION.REPLACE_NEW,
    });

    expect(attributeEditService.addValueToAttribute).toHaveBeenCalledTimes(1);
    const [replaceValue, createdValue, editedInstance, replaceFlag] = attributeEditService.addValueToAttribute.calls.mostRecent().args;
    expect((replaceValue as AttributeValue).value).toBe(oldReference);
    expect(createdValue).toBe(createdReference);
    expect(editedInstance).toBe(instance1);
    expect(replaceFlag).toBeTrue();
    expect(attributeEditService.addInstanceViaSelect).not.toHaveBeenCalled();
    expect(instUtil.addToModifiedAttributes).toHaveBeenCalledWith('referenceEntity', instance1);
    expect(instUtil.registerUpdatedInstance).toHaveBeenCalledWith('referenceEntity', instance1);
  });

  it('replaces a selected instance attribute via selection dialog (REPLACE_VIA_SELECT)', () => {
    const oldRef = { dbId: 10, schemaClassName: 'Ref', displayName: 'Old Ref' } as Instance;
    const otherRef = { dbId: 11, schemaClassName: 'Ref', displayName: 'Other Ref' } as Instance;
    const selectedRef = { dbId: 20, schemaClassName: 'Ref', displayName: 'Selected Ref' } as Instance;
    const instance1 = makeInstance(1, new Map<string, any>([['referenceEntity', oldRef]]));
    const instance2 = makeInstance(2, new Map<string, any>([['referenceEntity', otherRef]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = instanceAttribute;
    component.storeAggregatedAttributes = new Set([oldRef, otherRef]);
    dataService.fetchInstanceInBatch.and.returnValue(of([instance1, instance2]));
    // List dialog: user selects only oldRef to replace
    attributeListDialogService.openDialog.and.returnValue({ afterClosed: () => of([oldRef]) } as any);
    // Select dialog: user picks selectedRef as replacement (dbId > 0 → routes through addInstanceViaSelect)
    selectInstanceDialogService.openDialog.and.returnValue({ afterClosed: () => of([selectedRef]) } as any);

    component.onInstanceAttributeEdit({
      attribute: instanceAttribute,
      value: undefined,
      editAction: EDIT_ACTION.REPLACE_VIA_SELECT,
    });

    // Only instance1 has oldRef — instance2 should be skipped
    expect(attributeEditService.addInstanceViaSelect).toHaveBeenCalledTimes(1);
    const [avReplaced, selection, editedInstance, replFlag] =
      attributeEditService.addInstanceViaSelect.calls.mostRecent().args;
    expect((avReplaced as AttributeValue).value).toBe(oldRef);
    expect(selection).toEqual([selectedRef]);
    expect(editedInstance).toBe(instance1);
    expect(replFlag).toBeTrue();
    expect(attributeEditService.addValueToAttribute).not.toHaveBeenCalled();
    expect(instUtil.addToModifiedAttributes).toHaveBeenCalledWith('referenceEntity', instance1);
    expect(instUtil.registerUpdatedInstance).toHaveBeenCalledWith('referenceEntity', instance1);
  });

  it('adds an instance attribute to all instances via selection dialog (ADD_VIA_SELECT)', () => {
    const selectedRef = { dbId: 20, schemaClassName: 'Ref', displayName: 'Selected Ref' } as Instance;
    const instance1 = makeInstance(1, new Map<string, any>([['referenceEntity', null]]));
    const instance2 = makeInstance(2, new Map<string, any>([['referenceEntity', null]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = instanceAttribute;
    // Pre-populate cache so no network call is needed
    component._instances = [instance1, instance2];
    selectInstanceDialogService.openDialog.and.returnValue({ afterClosed: () => of([selectedRef]) } as any);

    component.onInstanceAttributeEdit({
      attribute: instanceAttribute,
      value: undefined,
      editAction: EDIT_ACTION.ADD_VIA_SELECT,
    });

    // No list dialog for a non-replace action
    expect(attributeListDialogService.openDialog).not.toHaveBeenCalled();
    // addInstanceViaSelect called once per instance (not replace → no filtering)
    expect(attributeEditService.addInstanceViaSelect).toHaveBeenCalledTimes(2);
    const callArgs = attributeEditService.addInstanceViaSelect.calls.allArgs();
    const editedInstances = callArgs.map(args => args[2] as Instance);
    expect(editedInstances).toContain(instance1);
    expect(editedInstances).toContain(instance2);
    // replace flag must be false for an ADD action
    callArgs.forEach(args => expect(args[3]).toBeFalse());
  });

  it('applies a boolean attribute edit only on instances whose current value matches', () => {
    const boolAttribute: SchemaAttribute = {
      name: 'isInferred',
      cardinality: '1',
      origin: 'TestClass',
      category: AttributeCategory.OPTIONAL,
      definingType: AttributeDefiningType.NONE_DEFINING,
      type: AttributeDataType.BOOLEAN,
    };
    // instance1 already holds `true` → matches attributeValue.value → should be edited
    // instance2 holds `false` → does not match → should be skipped
    const instance1 = makeInstance(1, new Map<string, any>([['isInferred', true]]));
    const instance2 = makeInstance(2, new Map<string, any>([['isInferred', false]]));
    const component = createComponent([instance1, instance2]);

    component.selectedAttribute = boolAttribute;
    component._instances = [instance1, instance2];

    component.onBooleanAttributeEdit({
      attribute: boolAttribute,
      value: true,
    });

    // Only instance1 should receive the edit (replace=true, matchesReplaceTarget uses attributeValue.value as search key)
    expect(attributeEditService.onNoInstanceAttributeEdit).toHaveBeenCalledTimes(1);
    const [editedAttrValue, newValue, editedInstance, replaceFlag] =
      attributeEditService.onNoInstanceAttributeEdit.calls.mostRecent().args;
    expect(editedInstance).toBe(instance1);
    expect(newValue).toBe(true);
    expect(replaceFlag).toBeTrue();
    expect(instUtil.addToModifiedAttributes).toHaveBeenCalledWith('isInferred', instance1);
    expect(instUtil.registerUpdatedInstance).toHaveBeenCalledWith('isInferred', instance1);
  });

  it('removes an instance from the batch list and restores it on undo without duplicates', () => {
    const instance1 = makeInstance(1, new Map<string, any>());
    const instance2 = makeInstance(2, new Map<string, any>());
    const component = createComponent([instance1, instance2]);

    // Remove instance1
    component.handleListTableAction({ instance: instance1, action: 'close' });

    expect(component.data).not.toContain(instance1);
    expect(component.data).toContain(instance2);
    expect(component.removedInstances).toContain(instance1);

    // Removing again must not create a duplicate in removedInstances
    component.handleListTableAction({ instance: instance1, action: 'close' });
    expect(component.removedInstances.filter(i => i.dbId === instance1.dbId).length).toBe(1);

    // Undo restores instance1 to data
    component.handleRemovedTableAction({ instance: instance1, action: 'undo' });

    expect(component.data).toContain(instance1);
    expect(component.removedInstances).not.toContain(instance1);

    // A second undo must not duplicate instance1 in data
    component.handleRemovedTableAction({ instance: instance1, action: 'undo' });
    expect(component.data.filter(i => i.dbId === instance1.dbId).length).toBe(1);
  });
});
