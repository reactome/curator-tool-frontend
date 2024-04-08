import {
  CdkDragDrop,
  CdkDragEnter, moveItemInArray,
  transferArrayItem
} from "@angular/cdk/drag-drop";
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { InstanceActions } from 'src/app/schema-view/instance/state/instance.actions';
import { AttributeCategory, SchemaAttribute } from "../../../../../core/models/reactome-schema.model";
import { DragDropService } from "../../../../instance-bookmark/drag-drop.service";
import {
  SelectInstanceDialogService
} from "../../../../list-instances/components/select-instance-dialog/select-instance-dialog.service";
import { NewInstanceDialogService } from '../../new-instance-dialog/new-instance-dialog.service';
import { AttributeValue, DragDropStatus, EDIT_ACTION, InstanceDataSource } from './instance-table.model';
import { PostEditListener } from "src/app/core/post-edit/PostEditOperation";

/**
 * This is the actual table component to show the content of an Instance.
 */
@Component({
  selector: 'app-instance-table',
  templateUrl: './instance-table.component.html',
  styleUrls: ['./instance-table.component.scss'],
})
export class InstanceTableComponent implements PostEditListener {
  displayedColumns: string[] = ['name', 'value'];
  showFilterOptions: boolean = false;
  showHeaderActions: boolean = false;
  sortAttNames: boolean = true;
  sortAttDefined: boolean = false;

  categoryNames = Object.keys(AttributeCategory).filter((v) => isNaN(Number(v)));
  categories: Map<AttributeCategory, boolean> = new Map<AttributeCategory, boolean>();

  // The instance to be displayed
  instanceDataSource: InstanceDataSource = new InstanceDataSource(undefined, this.categories, this.sortAttNames, this.sortAttDefined);
  // Keep it for editing
  _instance?: Instance;
  // flag to indicate if it is in a edit mode
  isInEditing: boolean = false;

  // For comparison
  _referenceInstance?: Instance;
  showReferenceColumn: boolean = false;
  draggedInstance?: Instance;

  // For highlighting rows during drag/drop event-view
  dragDropStatus: DragDropStatus = {
    dragging: false,
    dropping: false,
    draggedInstance: undefined
  }

  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    this._instance = instance;
    this.isInEditing = false;
    this.updateTableContent();
    this.isInEditing = true; // After the table is shown, the instance is in editing mode
  };

  @Input() set referenceInstance(refInstance: Instance | undefined) {
    this._referenceInstance = refInstance;
    this.isInEditing = false;
    this.updateTableContent();
    this.isInEditing = true; // After the table is shown, the instance is in editing mode
    if (refInstance === undefined) {
      this.showReferenceColumn = false
      this.displayedColumns = ['name', 'value']
    } else {
      this.showReferenceColumn = true;
      this.displayedColumns = ['name', 'value', 'referenceValue']
    }
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store,
    private postEditService: PostEditService) {
    for (let category of this.categoryNames) {
      let categoryKey = category as keyof typeof AttributeCategory;
      this.categories.set(AttributeCategory[categoryKey], true)
    }
    this.dragDropService.register("instance-table")
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
    if (data.attribute.cardinality === '1') {
      this._instance?.attributes?.set(data.attribute.name, data.value);
    } else { // This should be a list
      let valueList = this._instance?.attributes!.get(data.attribute.name);
      if (valueList === undefined) {
        this._instance?.attributes?.set(data.attribute.name, [data.value]);
      } else {
        valueList[data.index!] = data.value;
        console.debug(valueList);
      }
    }
    this.postEdit(data.attribute.name);
    this.updateTableContent(); // In case the display name is changed
    // Change in this type of attribute doesn't need to update the table content.
    // Therefore, we need to register it here
    this.registerUpdatedInstance();
  }

  onInstanceAttributeEdit(attributeValue: AttributeValue) {
    console.debug("onEdit: ", attributeValue);
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
  private deleteInstanceAttribute(attributeValue: AttributeValue): void {
    console.debug('deleteInstanceAttribute: ', attributeValue);
    if (attributeValue.attribute.cardinality === '1') {
      // This should not occur. Just in case
      //this._instance?.attributes?.delete(attributeValue.attribute?.name);
      this._instance?.attributes?.set(attributeValue.attribute?.name, undefined);
    } else {
      // This should be a list
      const valueList: [] = this._instance?.attributes?.get(attributeValue.attribute.name);
      // Remove the value if more than one
      if(valueList.length > 1){
        valueList.splice(attributeValue.index!, 1);
      }
      // Otherwise need to set the value to undefined so a value is assigned
      else {
        this._instance?.attributes?.set(attributeValue.attribute?.name, undefined);
      }
    }
    this.postEdit(attributeValue.attribute.name);
    this.updateTableContent();
  }

  private addNewInstanceAttribute(attributeValue: AttributeValue): void {
    const matDialogRef = this.dialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe(result => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (result === undefined)
        return; // Do nothing
      // Check if there is any value
      this.addValueToAttribute(attributeValue, result);
    });
  }

  private addInstanceViaSelect(attributeValue: AttributeValue) {
    const matDialogRef = this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe(result => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (result === undefined || !result)
        return; // Do nothing if this is undefined or resolve to false (e.g. nothing there)
      // Check if there is any value
      //this.addValueToAttribute(attributeValue, result);
      let value = this._instance?.attributes?.get(attributeValue.attribute.name);
      if (value === undefined) {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') {
          this._instance?.attributes?.set(attributeValue.attribute.name, result[0]);
        } else {
          this._instance?.attributes?.set(attributeValue.attribute.name, result);
        }
      } else {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') { // Make sure only one value used
          this._instance?.attributes?.set(attributeValue.attribute.name, result.length > 0 ? result[0] : undefined);
        } else {
          value.splice(attributeValue.index, 0, ...result);
        }
      }
      //Only add attribute name if value was added
      this.postEdit(attributeValue.attribute.name);
      //TODO: Add a new value may reset the scroll position. This needs to be changed!
      this.updateTableContent();
    });
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
        this._instance?.attributes?.set(attributeValue.attribute.name, [result]);
      }
    } else {
      // It should be the first
      if (attributeValue.attribute.cardinality === '1') { // Make sure only one value used
        this._instance?.attributes?.set(attributeValue.attribute.name, result);
      } else {
        value.splice(attributeValue.index, 0, result);
      }
    }
    // Only add attribute name if value was added
    //TODO: This causes the Angular N100 error about state change after view established. Need more refactoring!
    this.postEdit(attributeValue.attribute.name);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
  }

  donePostEdit(instance: Instance, editedAttributeName: string | undefined): boolean {
    this.updateTableContent();
    return true;
  }

  updateTableContent(): void {
    this.instanceDataSource = new InstanceDataSource(this._instance,
                                                    this.categories,
                                                    this.sortAttNames,
                                                    this.sortAttDefined,
                                                    this._referenceInstance);
    this.instanceDataSource.connect();
    if (this.isInEditing) {
      // Register the updated instances
      this.registerUpdatedInstance();
    }
  }

  private registerUpdatedInstance(): void {
    // Only register updates to exisiting instances
    if (this._instance!.dbId > 0) {
      let cloned: Instance = {
        dbId: this._instance!.dbId,
        displayName: this._instance!.displayName,
        schemaClassName: this._instance!.schemaClassName
      };
      // Have to make a clone to avoid any change to the current _instance!
      this.store.dispatch(InstanceActions.register_updated_instance(cloned));
    }
  }

  addModifiedAttributeName(attName: string) {
    // Do nothing if there is no instance
    if (this._instance === undefined)
      return;
    if (this._instance.modifiedAttributes == undefined)
      this._instance.modifiedAttributes = [attName];
    else if (!this._instance.modifiedAttributes.includes(attName))
      // Somehow ngrx/store make modifiedAttributes immutable
      this._instance.modifiedAttributes.push(attName);
  }

  /**
   * Provide a hook to do something (e.g. update display name, perform QA etc) after 
   * any editing.
   * @param attName
   */
  postEdit(attName: string) {
    if (this._instance)
      this.postEditService.postEdit(this._instance, attName, this);
    this.addModifiedAttributeName(attName);
  }

  drop(event: CdkDragDrop<string[]>, value: SchemaAttribute) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    }
    else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    console.log("value", this._instance)
    this._instance?.attributes?.set(value.name, event.container.data);
  }


  stopDragging() {
    console.debug('stopDragging because of drag exit');
    this.dragDropStatus = {
      dragging: false,
      dropping: false,
      draggedInstance: undefined
    }
  }

  protected readonly AttributeCategory = AttributeCategory;

  bookmarkDrop($event: CdkDragDrop<Instance | undefined>) {
    console.debug('bookmarkDrop: ', $event);
    this.dragDropStatus = {
      dragging: false,
      dropping: true,
      draggedInstance: $event.item.data
    }
  }

  dragEntering($event: CdkDragEnter<Instance | undefined>) {
    console.debug("dragEntering: ", $event.item.data)
    this.dragDropStatus = {
      dragging: true,
      dropping: false,
      draggedInstance: $event.item.data
    }
  }
}
