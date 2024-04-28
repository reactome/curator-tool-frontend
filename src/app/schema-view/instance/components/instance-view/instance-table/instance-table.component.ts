import {
  CdkDragDrop,
  CdkDragEnter,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { InstanceActions } from 'src/app/schema-view/instance/state/instance.actions';
import {
  AttributeCategory,
  AttributeDataType,
  SchemaAttribute,
} from '../../../../../core/models/reactome-schema.model';
import { DragDropService } from '../../../../instance-bookmark/drag-drop.service';
import {
  SelectInstanceDialogService
} from '../../../../list-instances/components/select-instance-dialog/select-instance-dialog.service';
import { NewInstanceDialogService } from '../../new-instance-dialog/new-instance-dialog.service';
import {
  AttributeValue,
  DragDropStatus,
  EDIT_ACTION,
  InstanceDataSource,
} from './instance-table.model';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import { NewInstanceActions } from 'src/app/schema-view/instance/state/instance.actions';

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

  categoryNames = Object.keys(AttributeCategory).filter((v) =>
    isNaN(Number(v))
  );
  categories: Map<AttributeCategory, boolean> = new Map<
    AttributeCategory,
    boolean
  >();
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;

  // The instance to be displayed
  instanceDataSource: InstanceDataSource = new InstanceDataSource(
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
  modifiedAtts: string[] = [];

  // For highlighting rows during drag/drop event-view
  dragDropStatus: DragDropStatus = {
    dragging: false,
    dropping: false,
    draggedInstance: undefined,
  };

  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    this._instance = instance;
    this.updateTableContent();
  }

  @Input() set referenceInstance(refInstance: Instance | undefined) {
    this._referenceInstance = refInstance;
    this.updateTableContent();
    if (refInstance === undefined) {
      this.showReferenceColumn = false;
      this.displayedColumns = ['name', 'value'];
    } else {
      this.showReferenceColumn = true;
      this.displayedColumns = ['name', 'value', 'referenceValue'];
    }
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store,
    private postEditService: PostEditService
  ) {
    for (let category of this.categoryNames) {
      let categoryKey = category as keyof typeof AttributeCategory;
      this.categories.set(AttributeCategory[categoryKey], true);
    }
    this.dragDropService.register('instance-table');
  } // Use a dialog service to hide the implementation of the dialog.

  changeShowFilterOptions() {
    this.showFilterOptions = !this.showFilterOptions;
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
    let value = this._instance?.attributes?.get(data.attribute.name);
    this.addModifiedAttribute(data.attribute.name, value);
    if (data.attribute.cardinality === '1') {
      this._instance?.attributes?.set(data.attribute.name, data.value);
    } else {
      // This should be a list
      if (data.value === '') {
        value.splice(data.index, 1);
      } else {
        let valueList = this._instance?.attributes!.get(data.attribute.name);
        if (valueList === undefined) {
          this._instance?.attributes?.set(data.attribute.name, [data.value]);
        } else {
          if (data.index! < 0) {
            value.push(data.value);
          } else {
            value[data.index!] = data.value;
          }
        }
      }
    }
    this.finishEdit(data.attribute.name, data.value);
  }

  deleteAttributeValue(attributeValue: AttributeValue) {
    console.log('deleteAttributeValue: ', attributeValue);
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    //this.addModifiedAttribute(attributeValue.attribute.name, value);
    if (attributeValue.attribute.cardinality === '1') {
      // This should not occur. Just in case
      //this._instance?.attributes?.delete(attributeValue.attribute?.name);
      this._instance?.attributes?.set(
        attributeValue.attribute?.name,
        undefined
      );
    } else {
      // This should be a list
      const valueList: [] = this._instance?.attributes?.get(
        attributeValue.attribute.name
      );
      // Remove the value if more than one
      if (valueList.length > 1) {
        valueList.splice(attributeValue.index!, 1);
      }
      // Otherwise need to set the value to undefined so a value is assigned
      else {
        this._instance?.attributes?.set(
          attributeValue.attribute?.name,
          undefined
        );
      }
    }
    this.finishEdit(attributeValue.attribute.name, undefined);
  }

  onInstanceAttributeEdit(attributeValue: AttributeValue) {
    console.debug('onEdit: ', attributeValue);
    switch (attributeValue.editAction) {
      case EDIT_ACTION.DELETE:
        this.deleteInstanceAttribute(attributeValue);
        break;
      case EDIT_ACTION.ADD_NEW:
        this.addNewInstanceAttribute(attributeValue);
        break;
      case EDIT_ACTION.ADD_VIA_SELECT:
        this.addInstanceViaSelect(attributeValue);
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

  private deleteInstanceAttribute(attributeValue: AttributeValue): void {
    console.debug('deleteInstanceAttribute: ', attributeValue);
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    if (attributeValue.attribute.cardinality === '1') {
      // This should not occur. Just in case
      //this._instance?.attributes?.delete(attributeValue.attribute?.name);
      this._instance?.attributes?.set(
        attributeValue.attribute?.name,
        undefined
      );
    } else {
      // This should be a list
      const valueList: [] = this._instance?.attributes?.get(
        attributeValue.attribute.name
      );
      // Remove the value if more than one
      if (valueList.length > 1) {
        valueList.splice(attributeValue.index!, 1);
      }
      // Otherwise need to set the value to undefined so a value is assigned
      else {
        this._instance?.attributes?.set(
          attributeValue.attribute?.name,
          undefined
        );
      }
    }
    this.finishEdit(attributeValue.attribute.name, value);
  }

  private addNewInstanceAttribute(attributeValue: AttributeValue): void {
    const matDialogRef = this.dialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (result === undefined) return; // Do nothing
      // Check if there is any value
      this.addValueToAttribute(attributeValue, result);
    });
  }

  private addInstanceViaSelect(attributeValue: AttributeValue) {
    const matDialogRef =
      this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (result === undefined || !result) return; // Do nothing if this is undefined or resolve to false (e.g. nothing there)
      // Check if there is any value
      //this.addValueToAttribute(attributeValue, result);
      let value = this._instance?.attributes?.get(
        attributeValue.attribute.name
      );
      if (value === undefined) {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') {
          this._instance?.attributes?.set(
            attributeValue.attribute.name,
            result[0]
          );
        } else {
          this._instance?.attributes?.set(
            attributeValue.attribute.name,
            result
          );
        }
      } else {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') {
          // Make sure only one value used
          this._instance?.attributes?.set(
            attributeValue.attribute.name,
            result.length > 0 ? result[0] : undefined
          );
        } else {
          value.splice(attributeValue.index, 0, ...result);
        }
      }
      this.finishEdit(attributeValue.attribute.name, value);
    });
  }

  finishEdit(attName: string, value: any) {
    //Only add attribute name if value was added
    this.postEdit(attName);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
    // Register the updated instances
    this.registerUpdatedInstance();
    this.addModifiedAttribute(attName, value);
    // Fire an event for other components to update their display (e.g. display name)
    this.editedInstance.emit(this._instance);
  }

  addBookmarkedInstance(attributeValue: AttributeValue) {
    let result = attributeValue.value; //Only one value emitted at once
    this.addValueToAttribute(attributeValue, result);
    this.cdr.detectChanges();
  }

  private addValueToAttribute(attributeValue: AttributeValue, result: any) {
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    if (value === undefined) {
      // It should be the first
      if (attributeValue.attribute.cardinality === '1') {
        this._instance?.attributes?.set(attributeValue.attribute.name, result);
      } else {
        this._instance?.attributes?.set(attributeValue.attribute.name, [
          result,
        ]);
      }
    } else {
      // It should be the first
      if (attributeValue.attribute.cardinality === '1') {
        // Make sure only one value used
        this._instance?.attributes?.set(attributeValue.attribute.name, result);
      } else {
        value.splice(attributeValue.index, 0, result);
      }
    }
    this.finishEdit(attributeValue.attribute.name, value);
  }

  donePostEdit(
    instance: Instance,
    editedAttributeName: string | undefined
  ): boolean {
    this.updateTableContent();
    return true;
  }

  updateTableContent(): void {
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

  private registerUpdatedInstance(): void {
    // Only register updates to exisiting instances
    let cloned: Instance = {
      dbId: this._instance!.dbId,
      displayName: this._instance!.displayName,
      schemaClassName: this._instance!.schemaClassName,
      //modifiedAttributes: this.modifiedAtts
    };
    if (this._instance!.dbId > 0) {
      // Have to make a clone to avoid any change to the current _instance!
      this.store.dispatch(InstanceActions.register_updated_instance(cloned));
    } else {
      // Force the state to update if needed
      this.store.dispatch(NewInstanceActions.register_new_instance(cloned));
    }
  }

  addModifiedAttribute(attributeName: string, attributeVal: any) {
    // Do nothing if there is no instance
    if (this._instance === undefined) return;
    if (this._instance.modifiedAttributes === undefined) {
      this._instance.modifiedAttributes = [];
    }
    if (!this._instance.modifiedAttributes.includes(attributeName))
      this._instance.modifiedAttributes.push(attributeName);
  }

  removeModifiedAttribute(attributeName: string) {
    if (
      this._instance === undefined ||
      this._instance.modifiedAttributes === undefined
    )
      return;
    let index = this._instance.modifiedAttributes.indexOf(attributeName);
    if (index > -1)
      this._instance.modifiedAttributes.splice(index, 1);
    // If nothing is in the modifiedAttributes, remove this instance from the changed list
    if (this._instance.modifiedAttributes.length === 0) {
      this.store.dispatch(
        InstanceActions.remove_updated_instance(this._instance)
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

  compareToDbInstance(attName: string): boolean {
    if (!this._referenceInstance) return false;
    let instanceVal = this._instance?.attributes.get(attName);
    let refVal = this._referenceInstance?.attributes.get(attName);
    if ((instanceVal && instanceVal.dbId) || instanceVal instanceof Array) {
      return this.getValueTypeForComparison(instanceVal, refVal);
    }
    return instanceVal !== refVal;
  }

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
    let refValue = attributeValue.referenceValue;
    if (refValue) {
      if (attributeValue.attribute.cardinality === '1') {
        this._instance.attributes.set(
          attributeValue.attribute.name,
          refValue
        );
      } else {
        this._instance.attributes.set(
          attributeValue.attribute.name,
          [...refValue]
        );
      }
    } else {
      // Use delete for the map!
      this._instance.attributes.delete(attributeValue.attribute.name);
    }
    // Update the status of this table
    this.postEdit(attributeValue.attribute.name);
    this.updateTableContent();
    // Call this as the last step to update the list of changed instances.
    this.removeModifiedAttribute(attributeValue.attribute.name);
  }

  filterEditedValues() {
    this.filterEdited = !this.filterEdited;
    this.updateTableContent();
  }
}
