import {CdkDragDrop, CdkDragEnter, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {ChangeDetectorRef, Component, Input} from '@angular/core';
import {Store} from '@ngrx/store';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {PostEditService} from 'src/app/core/services/post-edit.service';
import {InstanceActions} from 'src/app/schema-view/instance/state/instance.actions';
import {AttributeCategory, AttributeDataType, SchemaAttribute} from "../../../../../core/models/reactome-schema.model";
import {DragDropService} from "../../../../instance-bookmark/drag-drop.service";
import {
  SelectInstanceDialogService
} from "../../../../list-instances/components/select-instance-dialog/select-instance-dialog.service";
import {NewInstanceDialogService} from '../../new-instance-dialog/new-instance-dialog.service';
import {AttributeValue, DragDropStatus, EDIT_ACTION, InstanceDataSource} from './instance-table.model';
import {PostEditListener} from "src/app/core/post-edit/PostEditOperation";
import { NewInstanceActions } from "src/app/schema-view/instance/state/instance.actions";

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
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;

  // The instance to be displayed
  instanceDataSource: InstanceDataSource = new InstanceDataSource(undefined, this.categories, this.sortAttNames, this.sortAttDefined);
  // Keep it for editing
  _instance?: Instance;
  // flag to indicate if it is in a edit mode
  isInEditing: boolean = false;

  // For comparison
  _referenceInstance?: Instance;
  showReferenceColumn: boolean = false;
  modifiedAtts: string[] = [];

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
    let value = this._instance?.attributes?.get(data.attribute.name);
    //this.addModifiedAttribute(data.attribute.name, value);
    if (data.attribute.cardinality === '1') {
      this._instance?.attributes?.set(data.attribute.name, data.value);
    } else { // This should be a list
      if(data.value === ''){
        console.log(data);
        this.deleteAttributeValue(data);
        return}
      let valueList = this._instance?.attributes!.get(data.attribute.name);
      if (valueList === undefined) {
        this._instance?.attributes?.set(data.attribute.name, [data.value]);
      } else {
        //valueList[data.index!] = data.value;
        value.splice(data.value.length, 0, ...[data.value]);

        console.debug(valueList);
      }
    }
    this.postEdit(data.attribute.name);
    this.updateTableContent(); // In case the display name is changed
    // Change in this type of attribute doesn't need to update the table content.
    // Therefore, we need to register it here
    this.registerUpdatedInstance();
  }

  deleteAttributeValue(attributeValue: AttributeValue){
    console.log('deleteAttributeValue: ', attributeValue);
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    //this.addModifiedAttribute(attributeValue.attribute.name, value);
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
  private newMap: any;
  private deleteInstanceAttribute(attributeValue: AttributeValue): void {
    console.debug('deleteInstanceAttribute: ', attributeValue);
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    this.addModifiedAttribute(attributeValue.attribute.name, value);
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
      //Only add attribute name if value was added
      this.addModifiedAttribute(attributeValue.attribute.name, value);
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
    //TODO: This causes the Angular N100 error about state change after view established. Need more refactoring!
    // Only add attribute name if value was added
    this.addModifiedAttribute(attributeValue.attribute.name, value);
    // Only add attribute name if value was added
    //TODO: This causes the Angular N100 error about state change after view established. Need more refactoring!
    this.postEdit(attributeValue.attribute.name);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
  }

  donePostEdit(instance: Instance,
               editedAttributeName: string | undefined): boolean {
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
    let cloned: Instance = {
      dbId: this._instance!.dbId,
      displayName: this._instance!.displayName,
      schemaClassName: this._instance!.schemaClassName,
      //modifiedAttributes: this.modifiedAtts
    };
    if (this._instance!.dbId > 0) {
      // Have to make a clone to avoid any change to the current _instance!
      this.store.dispatch(InstanceActions.register_updated_instance(cloned));
    }
    else { // Force the state to update if needed
      this.store.dispatch(NewInstanceActions.register_new_instances(cloned))
    }
  }

  addModifiedAttribute(attributeName: string, attributeVal: any) {
    // Do nothing if there is no instance
    if (this._instance === undefined)
      return;
    if (this._instance.modifiedAttributes === undefined) {
      let newModAtt: Map<string, any> = new Map<string, any>;
      newModAtt.set(attributeName, attributeVal);
      this._instance.modifiedAttributes = newModAtt;
    }
    this._instance?.modifiedAttributes?.set(attributeName, attributeVal);
    //this.modifiedAtts.push(attributeName);
    // console.log(this._instance);
  }

  removeModifiedAttribute(attributeName: string) {
    if (this._instance === undefined || this._instance.modifiedAttributes === undefined)
      return;
    this._instance.modifiedAttributes.delete(attributeName);
  }

  /**
   * Provide a hook to do something (e.g. update display name, perform QA etc) after
   * any editing.
   * @param attName
   */
  postEdit(attName: string) {
    if (this._instance)
      this.postEditService.postEdit(this._instance, attName, this);
    //this.addModifiedAttribute(attName);
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

  isAttributeModified(attName: string): boolean {
    if(!this._instance || !this._instance.modifiedAttributes) return false;
    //console.log(this._instance);
    return !!this._instance.modifiedAttributes.get(attName);
  }

  compareToDbInstance(attName: string): boolean {
    if(!this._referenceInstance) return false;
    let instanceVal = this._instance?.attributes.get(attName);
    let refVal = this._referenceInstance?.attributes.get(attName);
    if(instanceVal && instanceVal.dbId || instanceVal instanceof Array){
      return this.getValueTypeForComparison(instanceVal, refVal);
    }
    return instanceVal !== refVal;
  }

  getValueTypeForComparison(instanceVal: any, refVal: any){
    // One singular instance
    if(instanceVal.dbId) {
      if(refVal === undefined) return true;
      else {
        return instanceVal.dbId !== refVal.dbId
      }
    }
    // An array of instances
    else {
      if(refVal === undefined || instanceVal.length !== refVal.length) return true;
      else if(instanceVal[0].dbId) {
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
    if (!this._instance)
      return; // Do nothing
    this._instance.attributes.set(attributeValue.attribute.name, attributeValue.referenceValue)

    // Update the status of this table
    this.removeModifiedAttribute(attributeValue.attribute.name);
    this.postEdit(attributeValue.attribute.name);
    this.updateTableContent();
  }

}
