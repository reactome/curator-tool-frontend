import {
  CdkDragDrop,
  CdkDragEnter,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  SelectInstanceDialogService
} from 'src/app/schema-view/list-instances/components/select-instance-dialog/select-instance-dialog.service';
import {
  AttributeCategory,
  AttributeDataType,
  SchemaAttribute,
} from '../../../../core/models/reactome-schema.model';
import { DragDropService } from '../../../../schema-view/instance-bookmark/drag-drop.service';
import { NewInstanceDialogService } from '../../new-instance-dialog/new-instance-dialog.service';
import {
  DragDropStatus,
  InstanceDataSource,
} from './instance-table.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { deleteInstances } from 'src/app/instance/state/instance.selectors';
import { filter, map, Subscription, take } from 'rxjs';
import { AttributeValue, EDIT_ACTION } from 'src/app/core/models/reactome-instance.model';
import { InstanceComparisonDataSource } from './instance-table-comparison.model';

/**
 * This is the actual table component to show the content of an Instance.
 */
@Component({
  selector: 'app-instance-table',
  templateUrl: './instance-table.component.html',
  styleUrls: ['./instance-table.component.scss'],
})
export class InstanceTableComponent implements PostEditListener {
  // Fire an event when this instance is edited
  @Output() editedInstance = new EventEmitter<Instance>();
  displayedColumns: string[] = ['name', 'value'];
  showFilterOptions: boolean = false;
  showHeaderActions: boolean = false;
  sortAttNames: boolean = true;
  sortAttDefined: boolean = false;
  filterEdited: boolean = false;
  @Input() blockRouter: boolean = false;
  // During new instance creation in a diagram, don't fire any event
  @Input() preventEvent: boolean = false;
  // Flag to block the table update during editing
  inEditing: boolean = false;
  referenceColumnTitle: string = 'Reference Value';
  valueColumnTitle: string = 'Value';

  categoryNames = Object.keys(AttributeCategory).filter((v) =>
    isNaN(Number(v))
  );
  categories: Map<AttributeCategory, boolean> = new Map<
    AttributeCategory,
    boolean
  >();
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;

  // Data source for the table, can be either InstanceDataSource or InstanceComparisonDataSource
  instanceDataSource:
    | InstanceDataSource
    | InstanceComparisonDataSource = new InstanceDataSource(
      undefined,
      this.categories,
      this.sortAttNames,
      this.sortAttDefined,
      this.filterEdited
    );

  // Keep it for editing
  _instance?: Instance;

  // For comparison
  _referenceInstance?: Instance;
  showReferenceColumn: boolean = false;

  // For highlighting rows during drag/drop event-view
  dragDropStatus: DragDropStatus = {
    dragging: false,
    dropping: false,
    draggedInstance: undefined,
  };

  // To check if a value has been deleted
  deletedDBIds: number[] = [];

  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    if (this.inEditing)
      return; // In editing now. Nothing to change from outside.
    this._instance = instance;
    this.updateTableContent();
  }

  @Input() set referenceInstance(refInstance: Instance | undefined) {
    this.setReferenceInstance(refInstance!);
  }

  // Track subscriptions added so that we can remove them
  private subscriptions: Subscription = new Subscription()

  constructor(
    private cdr: ChangeDetectorRef,
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store,
    private instUtil: InstanceUtilities,
    private attributeEditService: AttributeEditService,
    private postEditService: PostEditService, // This is used to perform post-edit actions
  ) {
    for (let category of this.categoryNames) {
      let categoryKey = category as keyof typeof AttributeCategory;
      this.categories.set(AttributeCategory[categoryKey], true);
    }

    this.dragDropService.register('instance-table');

    let subscription = this.store.select(deleteInstances()).subscribe(instances => {
      this.deletedDBIds = instances.map(inst => inst.dbId);
    });
    this.subscriptions.add(subscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  changeShowFilterOptions() {
    this.showFilterOptions = !this.showFilterOptions;
  }

  setReferenceInstance(refInstance: Instance | undefined) {
    this._referenceInstance = refInstance;
    if (refInstance === undefined) {
      this.showReferenceColumn = false;
      this.displayedColumns = ['name', 'value'];
    }
    else {
      this.showReferenceColumn = true;
      this.displayedColumns = ['name', 'value', 'referenceValue'];
      if (this._instance?.dbId === refInstance.dbId) {
        this.referenceColumnTitle = 'Database Value'
      }
      else {
        this.referenceColumnTitle = this._referenceInstance?.displayName!;
        this.valueColumnTitle = this._instance?.displayName!;
      }
    }
    this.updateTableContent();
  }

  changeShowHeaderActions() {
    this.showHeaderActions = !this.showHeaderActions;
  }

  doFilter(category: AttributeCategory) {
    let checked = this.categories.get(category);
    this.categories.set(category, !checked);
    this.updateTableContent();
  }

  sort() {
    this.sortAttDefined = false;
    this.sortAttNames = !this.sortAttNames;
    this.updateTableContent();
  }

  sortByDefined() {
    this.sortAttDefined = !this.sortAttDefined;
    this.updateTableContent();
  }

  onNoInstanceAttributeEdit(data: AttributeValue) {
    // this.attributeEditService.onNoInstanceAttributeEdit(data, this._instance!);
    if (this._instance!.source) // Need to push the change to the source instance first
      this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!.source, false);
    this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!, false);
    this.finishEdit(data.attribute.name, undefined);
  }

  deleteAttributeValue(attributeValue: AttributeValue) {
    if (this._instance!.source)
      this.attributeEditService.deleteAttributeValue(this._instance!.source, attributeValue);
    this.attributeEditService.deleteAttributeValue(this._instance, attributeValue);
    this.finishEdit(attributeValue.attribute.name, undefined);
  }

  onInstanceAttributeEdit(attributeValue: AttributeValue) {
    console.debug('onEdit: ', attributeValue);
    switch (attributeValue.editAction) {
      case EDIT_ACTION.DELETE:
        this.deleteInstanceAttribute(attributeValue);
        break;
      case EDIT_ACTION.ADD_NEW:
        this.addNewInstanceAttribute(attributeValue, false);
        break;
      case EDIT_ACTION.ADD_VIA_SELECT:
        this.addInstanceViaSelect(attributeValue, false);
        break;
      case EDIT_ACTION.REPLACE_NEW:
        this.addNewInstanceAttribute(attributeValue, true);
        break;
      case EDIT_ACTION.REPLACE_VIA_SELECT:
        this.addInstanceViaSelect(attributeValue, true);
        break;
      case EDIT_ACTION.BOOKMARK:
        this.addBookmarkedInstance(attributeValue);
        break;
      default:
        console.error("The action doesn't know: ", attributeValue.editAction);
    }
  }

  //TODO: There is a bug here. If there is only one value in an attribute, delete
  // this value will disable the action menu popup!
  private newMap: any;


  private addNewInstanceAttribute(attributeValue: AttributeValue, replace: boolean
  ): void {
    const matDialogRef = this.dialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (result === undefined || result === this.instUtil.getShellInstance(result)) return; // Do nothing
      // Check if there is any value
      // Use cached shell instance
      if (this._instance!.source)
        this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!.source, replace);
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!, replace);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    // If there is a source instance, map the index based on dbId
    if (this._instance?.source) {
      const sourceAttributeValue = this.mapppingIndexInSourceInstance(attributeValue);
      this.attributeEditService.deleteInstanceAttribute(sourceAttributeValue, this._instance.source);
    }
    this.attributeEditService.deleteInstanceAttribute(attributeValue, this._instance!);
    this.finishEdit(attributeValue.attribute.name, attributeValue.value);
  }

  private mapppingIndexInSourceInstance(attributeValue: AttributeValue): AttributeValue {
    let sourceAttributeValue = attributeValue;
    const sourceValues = this._instance!.source!.attributes.get(attributeValue.attribute.name) || [];
    const targetValue = this._instance!.attributes.get(attributeValue.attribute.name) || [];
    sourceValues.forEach((element: { dbId: any; }) => {
      if (Array.isArray(targetValue)) {
        for (let val of targetValue) {
          if (element.dbId === val.dbId) {
            let sourceIndex = sourceValues.indexOf(element);
            if (sourceIndex !== -1) {
              sourceAttributeValue = { ...attributeValue, index: sourceIndex };
            }
          }
        }
      }
    });

    return sourceAttributeValue
  }

  private addInstanceViaSelect(attributeValue: AttributeValue, replace: boolean) {
    const matDialogRef =
      this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      if (result === undefined || result.length === 0) return; // Do nothing
      if (this._instance!.source)
        this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!.source, replace);
      this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!, replace);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  // Note: the value parameter is not used here, but kept for future extension
  finishEdit(attName: string, value: any, removeModifiedAttribute: boolean = false) {
    this.inEditing = true;
    //Only add attribute name if value was added
    this.postEdit(attName);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
    // Need to call this before registerUpdatedInstance
    // in case the instance is used somewhere via the ngrx state management system
    if (!removeModifiedAttribute) {
      this.attributeEditService.addModifiedAttribute(this._instance, attName);
      this.attributeEditService.addModifiedAttribute(this._instance!.source, attName);
    } else {
      this.removeModifiedAttribute(attName);
    }
    // Register the updated instances
    this.registerUpdatedInstance(attName);
    // Fire an event for other components to update their display (e.g. display name)
    // Usually this should be fired without issue
    this.editedInstance.emit(this._instance);
    if (this._instance?.source) {
      this.editedInstance.emit(this._instance.source);
    }
    this.inEditing = false;
  }

  addBookmarkedInstance(attributeValue: AttributeValue) {
    let result = attributeValue.value; //Only one value emitted at once

    if (this._instance!.source)
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!.source);
    this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!);
    this.finishEdit(attributeValue.attribute.name, attributeValue.value);
    this.cdr.detectChanges();
  }

  donePostEdit(
    instance: Instance,
    editedAttributeName: string | undefined
  ): boolean {
    this.updateTableContent();
    return true;
  }

  donePreProcess(instance: Instance): boolean {
    this.updateTableContent();
    return true;
  }

  updateTableContent(): void {
    if (this._referenceInstance === undefined || this._referenceInstance?.dbId !== this._instance?.dbId) {
      this.instanceDataSource = new InstanceDataSource(
        this._instance,
        this.categories,
        this.sortAttNames,
        this.sortAttDefined,
        this.filterEdited,
        this._referenceInstance
      );
      this.instanceDataSource.connect();
    }
    else {
      this.instanceDataSource = new InstanceComparisonDataSource(
        this._instance,
        this.categories,
        this.sortAttNames,
        this.sortAttDefined,
        this.filterEdited,
        this._referenceInstance
      );
      console.debug('updateTableContent - comparison data source: ', this.instanceDataSource);
      console.log('updateTableContent - comparison data source: ', this.instanceDataSource);
      this.instanceDataSource.connect();
    }
  }

  private registerUpdatedInstance(attName: string): void {
    if (this.preventEvent)
      return;
    let cloned: Instance = this.instUtil.makeShell(this._instance!);
    if (this._instance!.dbId > 0) {
      // Have to make a clone to avoid any change to the current _instance!
      this.store.dispatch(UpdateInstanceActions.register_updated_instance(cloned));
    } else {
      // Force the state to update if needed
      this.store.dispatch(NewInstanceActions.register_new_instance(cloned));
    }
    this.store.dispatch(UpdateInstanceActions.last_updated_instance({ attribute: attName, instance: cloned }));
  }

  private removeModifiedAttribute(attributeName: string) {
    if (
      this._instance === undefined ||
      this._instance.modifiedAttributes === undefined
    )
      return;
    // If nothing is in the modifiedAttributes, remove this instance from the changed list
    if (this._instance.source)
      this.attributeEditService.removeModifiedAttribute(this._instance.source, attributeName);
    this.attributeEditService.removeModifiedAttribute(this._instance, attributeName);
    if (this._instance.modifiedAttributes.length === 0) {
      this.store.dispatch(
        // Always make a shell when dispatch to avoid lock the instance by ngrx store!!!
        UpdateInstanceActions.remove_updated_instance(this.instUtil.makeShell(this._instance))
      );
    }
  }

  /**
   * Provide a hook to do something (e.g. update display name, perform QA etc) after
   * any editing.
   * @param attName
   */
  postEdit(attName: string) {
    if (this._instance)
      this.postEditService.postEdit(this._instance, attName, this);
    if (this._instance?.source)
      this.postEditService.postEdit(this._instance.source, attName, this);
  }

  drop(event: CdkDragDrop<string[]>, value: SchemaAttribute) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    console.debug('value', this._instance);
    if (this._instance?.source)
      this._instance?.source?.attributes?.set(value.name, event.container.data);
    this._instance?.attributes?.set(value.name, event.container.data);
    this.finishEdit(value.name, event.container.data);
  }

  stopDragging() {
    console.debug('stopDragging because of drag exit');
    this.dragDropStatus = {
      dragging: false,
      dropping: false,
      draggedInstance: undefined,
    };
  }

  protected readonly AttributeCategory = AttributeCategory;

  bookmarkDrop($event: CdkDragDrop<Instance | undefined>) {
    console.debug('bookmarkDrop: ', $event);
    this.dragDropStatus = {
      dragging: false,
      dropping: true,
      draggedInstance: $event.item.data,
    };
  }

  dragEntering($event: CdkDragEnter<Instance | undefined>) {
    console.debug('dragEntering: ', $event.item.data);
    this.dragDropStatus = {
      dragging: true,
      dropping: false,
      draggedInstance: $event.item.data,
    };
  }

  // values removed or edited passively should be compared to the instance value 
  // to display the passive index of a multivariate attribute 
  getValueTypeForComparison(instanceVal: any, refVal: any) {
    // One singular instance
    if (instanceVal.dbId) {
      if (refVal === undefined) return true;
      else {
        return instanceVal.dbId !== refVal.dbId;
      }
    }
    // An array of instances
    else {
      if (refVal === undefined || instanceVal.length !== refVal.length)
        return true;
      else if (instanceVal[0].dbId) {
        for (let i = 0; i < instanceVal.length; i++) {
          if (instanceVal[i].dbId !== refVal[i].dbId) {
            return true;
          }
        }
      }
      // An array of non-instances
      else {
        for (let i = 0; i < instanceVal.length; i++) {
          if (instanceVal[i] !== refVal[i]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  resetEdit(attributeValue: AttributeValue) {
    if (!this._instance) return; // Do nothing
    if (this._instance.source) {
      this.attributeEditService.resetAttributeValue(this._instance.source, attributeValue);
    }
    // Need a small utility to check that instance has not been deleted 
    let filteredValues = this.filterAttributeValueForDeletion(attributeValue);
    let attributeValueClone: AttributeValue = {
      attribute: attributeValue.attribute,
      referenceValue: filteredValues,
      value: attributeValue.value
    };
    this.attributeEditService.resetAttributeValue(this._instance, attributeValueClone);
    this.finishEdit(attributeValue.attribute.name, attributeValue.value, true);
  }

  private filterAttributeValueForDeletion(attributeValue: AttributeValue): any {
    if (!attributeValue || !attributeValue.referenceValue) return undefined;
    // If value is an array, filter out deleted dbIds
    if (Array.isArray(attributeValue.referenceValue)) {
      return attributeValue.referenceValue
        .filter(
          (val: any) => !(val && val.dbId && this.deletedDBIds.includes(val.dbId))
        );
    }
    // If value is a single instance, check dbId
    if (attributeValue.referenceValue.dbId) {
      return this.deletedDBIds.includes(attributeValue.referenceValue.dbId) ? undefined : attributeValue.referenceValue;
    }
    // For primitive values, just return as is
    return attributeValue.referenceValue;
  }

  filterEditedValues() {
    this.filterEdited = !this.filterEdited;
    this.updateTableContent();
  }

  isRequired(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.REQUIRED && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  isMandatory(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.MANDATORY && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  isInstanceDeleted(): boolean {
    if (this.deletedDBIds.length === 0) return false;
    if (this.deletedDBIds.includes(this._instance!.dbId)) return true;
    return false;
  }

  isActiveEdited(attName: string): boolean {
    // For comparison mode (instance vs reference instance)
    if (this._referenceInstance && this._instance?.dbId !== this._referenceInstance?.dbId) {
      let instanceVal = this._instance?.attributes.get(attName);
      let refVal = this._referenceInstance?.attributes.get(attName);
      if ((instanceVal && instanceVal.dbId) || instanceVal instanceof Array) {
        return this.getValueTypeForComparison(instanceVal, refVal);
      }
      return (instanceVal !== refVal);
    }
    // For regular edit mode (check if attribute was modified by user)
    return this._instance?.modifiedAttributes?.includes(attName) || false;
  }

  activeAndPassiveEdit(attName: string): boolean {
    let hasActiveEdit = this.isActiveEdited(attName);
    let hasPassiveEdit = this.isPassiveEdited(attName);
    return hasActiveEdit && hasPassiveEdit;
  }

  isPassiveEdited(attName: string): boolean {
    return this._instance?.passiveModifiedAttributes?.includes(attName) || false;
  }

}
