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
import { map, Observable, of, take } from 'rxjs';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeValue, EDIT_ACTION, InstanceComparisonDataSource } from './instance-table-comparison.model';
import { InstanceViewFilter } from 'src/app/core/instance-view-filters/InstanceViewFilter';
import { DeletedInstanceAttributeFilter } from 'src/app/core/instance-view-filters/DeletedInstanceAttributeFilter';
import { DisplayNameViewFilter } from 'src/app/core/instance-view-filters/DisplayNameViewFilter';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { ReviewStatusUpdateFilter } from 'src/app/core/instance-view-filters/ReviewStatusUpdateFilter';

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
  // During new instance creating in a diagram, don't fire any event
  @Input() preventEvent: boolean = false;
  // Flag to block the table update during editing
  inEditing: boolean = false;
  referenceColumnTitle: string = 'Reference Value';
  valueColumnTitle: string = 'Value';
  instanceViewFilters: InstanceViewFilter[] = [];

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
  modifiedAtts: string[] = [];

  // For highlighting rows during drag/drop event-view
  dragDropStatus: DragDropStatus = {
    dragging: false,
    dropping: false,
    draggedInstance: undefined,
  };

  disableEditing: boolean = false;
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

  constructor(
    private cdr: ChangeDetectorRef,
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store,
    private instUtil: InstanceUtilities,
    private attributeEditService: AttributeEditService,
    private dataService: DataService,
    private postEditService: PostEditService, // This is used to perform post-edit actions
    private reviewStatusCheck: ReviewStatusCheck
  ) {
    for (let category of this.categoryNames) {
      let categoryKey = category as keyof typeof AttributeCategory;
      this.categories.set(AttributeCategory[categoryKey], true);
    }
    this.instanceViewFilters = this.setUpInstanceViewFilters();

    this.dragDropService.register('instance-table');

    this.store.select(deleteInstances()).pipe(
      take(1),
      map((instances) => {
        this.deletedDBIds = instances.map(inst => inst.dbId);
      })
    ).subscribe();

  } // Use a dialog service to hide the implementation of the dialog.

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
    this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!, false);
    if (this._instance!.source)
      this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!.source, false);
    this.finishEdit(data.attribute.name, undefined);
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
    if (attributeValue.value === value) {
      // If the value is the same as the current value, do not update
      // This is to avoid unnecessary updates
      return;
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
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!, replace);
      if (this._instance!.source)
        this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!.source, replace);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    // if (this._instance!.source)
    //   this.attributeEditService.deleteInstanceAttribute(attributeValue, this._instance!.source);
    this.attributeEditService.deleteInstanceAttribute(attributeValue, this._instance!.source ? this._instance!.source : this._instance!);
    this.finishEdit(attributeValue.attribute.name, attributeValue.value);
  }

  private addInstanceViaSelect(attributeValue: AttributeValue, replace: boolean) {
    const matDialogRef =
      this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      if (result === undefined || result.length === 0) return; // Do nothing
      this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!, replace);
      if (this._instance!.source)
        this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!.source, replace);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  finishEdit(attName: string, value: any) {
    this.inEditing = true;
    //Only add attribute name if value was added
    this.postEdit(attName);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
    // Need to call this before registerUpdatedInstance
    // in case the instance is used somewhere via the ngrx statement management system
    this.addModifiedAttribute(attName, value);
    // Register the updated instances
    this.registerUpdatedInstance(attName);
    // Fire an event for other components to update their display (e.g. display name)
    // Usually this should be fired without issue
    this.editedInstance.emit(this._instance);
    if(this._instance?.source) {
      this.editedInstance.emit(this._instance.source);
    }
    this.inEditing = false;
  }

  addBookmarkedInstance(attributeValue: AttributeValue) {
    let result = attributeValue.value; //Only one value emitted at once

    this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!);
    if (this._instance!.source)
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(result), this._instance!.source);
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

  private addModifiedAttribute(attributeName: string, attributeVal: any) {
    // Do nothing if there is no instance
    if (this._instance === undefined) return;
    if (this._instance.modifiedAttributes === undefined) {
      this._instance.modifiedAttributes = [];
    }
    if (!this._instance.modifiedAttributes.includes(attributeName))
      this._instance.modifiedAttributes.push(attributeName);
  }

  private removeModifiedAttribute(attributeName: string) {
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
    // something more needed to be done
    this.store.dispatch(UpdateInstanceActions.last_updated_instance({
      attribute: attributeValue.attribute.name,
      instance: this.instUtil.makeShell(this._instance!)
    }));
    this.editedInstance.emit(this._instance)
  }

  filterEditedValues() {
    this.filterEdited = !this.filterEdited;
    this.updateTableContent();
  }

  highlightRequired(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.REQUIRED && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  highlightMandatory(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.MANDATORY && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  isValueDeleted(): boolean {
    if (this.deletedDBIds.length === 0) this.disableEditing = false;
    if (this.deletedDBIds.includes(this._instance!.dbId)) this.disableEditing = true;
    return this.disableEditing;
  }

  // Create a list to hold all service instances
  private setUpInstanceViewFilters(): InstanceViewFilter[] {
    return [
      new DeletedInstanceAttributeFilter(this.instUtil, this.store),
      new ReviewStatusUpdateFilter(this.dataService, this.instUtil, this.store, this.reviewStatusCheck),
      new DisplayNameViewFilter(this.dataService, this.instUtil, this.store),
    ];
  }

  compareDbToSourceInstance(dbId: number): boolean {
    return this.deletedDBIds.includes(dbId);
  }

  isActiveEdit(attName: string): boolean {
    if (!this._referenceInstance) return false;
    if (this._instance?.dbId !== this._referenceInstance?.dbId) return false;
    let instanceVal = this._instance?.attributes.get(attName);
    let refVal = this._referenceInstance?.attributes.get(attName);
    if ((instanceVal && instanceVal.dbId) || instanceVal instanceof Array) {
      return this.getValueTypeForComparison(instanceVal, refVal);
    }
    return (instanceVal !== refVal);
  }

  compareToDbInstance(attName: string): boolean {
    return this.isActiveEdit(attName);
  }

  activeAndPassiveEdit(attName: string, index?: number): boolean {
    let active = this._instance?.modifiedAttributes?.includes(attName) ? true : false;
    return this.isPassiveEdit(attName, index) && active;
  }

  compareToSourceInstance(attName: string, index?: number): boolean {
    if (this._instance?.modifiedAttributes?.includes(attName)) return false;
    if (!this._instance?.source) return false;
    return this.isPassiveEdit(attName, index);
  }

  isPassiveEdit(attName: string, index?: number): boolean {
    let instanceVal = this._instance?.attributes.get(attName);
    let refVal = this._instance?.source?.attributes.get(attName);
    if ((instanceVal && instanceVal.dbId) || instanceVal instanceof Array) {
      if (index)
        return this.singleValueCheck(attName, index!);
      else
        return this.getValueTypeForComparison(instanceVal, refVal);

    }
    return (instanceVal !== refVal);
  }

  singleValueCheck(attName: string, index: number): boolean {
    let isModified = this._instance?.modifiedAttributes?.includes(attName);
    let instanceVal = this._instance?.attributes.get(attName);
    if (!instanceVal) return false;
    if (!Array.isArray(instanceVal)) return false;
    let refVal = this._instance?.source?.attributes.get(attName);
    if (!refVal) return false;
    if (!Array.isArray(refVal)) return false;
    if (instanceVal.at(index) && refVal?.at(index)) {
      if (instanceVal.at(index).dbId && refVal.at(index).dbId) {
        // if(isModified && this._instance?.modifiedAttributes?.at(attName))
        return instanceVal.at(index).dbId !== refVal.at(index).dbId;
      } else {
        return instanceVal.at(index) !== refVal.at(index);
      }
    }
    return false;
  }


  // TODO: specify passively applied changes to the user. These edits do not affect the instance structure,
  // but are applied as filters via the instance view filters. For example, review status changes due to deletions of linked instances.
  // Compare instance attributes to source attributes to determine passively applied changes.

  // three versions of the instance: staged instance, database instance, source instance
  // the staged instance contains the active edits and passive edits
  // database instance contains no active or passive edits
  // source instance contains no active edits, but may contain passive edits
  // if an attribute value in the staged instance differs from the source instance, it is an active edit
  private filterPassiveEdits(attributeValues: AttributeValue[]): void {
    if (this.instance?.source) {
      attributeValues = attributeValues.filter(att => {
        let values = this.instance?.attributes?.get(att.attribute.name);
        let referenceValues = this.instance?.source?.attributes?.get(att.attribute.name);
        if (!values)
          values = [];
        if (!Array.isArray(values)) { values = [values]; }
        if (!referenceValues)
          referenceValues = [];
        if (!Array.isArray(referenceValues)) { referenceValues = [referenceValues]; }
        // if the values for a shared attribute differ, add them to be displayed 

        if (values.length !== referenceValues.length) {
          values.forEach((val: AttributeValue) => val.passiveEdit = true);
          return true;
        }

        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          const refVal = referenceValues[i];
          if (att.attribute.type === AttributeDataType.INSTANCE) {
            if (val?.dbId && refVal?.dbId && val.dbId !== refVal.dbId) {
              val.passiveEdit = true;
              return true; // once one value is different, add the whole attribute
            }
          } else {
            if (val !== refVal) {
              val.passiveEdit = true;
              return true;
            }
          }
        }
        return false;
      });

    }
  }

  // // Only Event Classes should be checked
  // checkReviewStatus(instance: Instance): Instance {

  //   let instanceCopy = instance;
  //   // check the list of deleted instances to see if there is any structural change to be removed
  //   // if a deleted instance is included in ie: hasEvent, input, output, catalystActivity, regulatedBy, change review status
  //   this.store.select(deleteInstances()).pipe(
  //     take(1),
  //     map((instances) => {
  //       let deletedDbIds = instances.map(inst => inst.dbId);
  //       this.dataService.fetchInstanceFromDatabase(instance.dbId!, false).subscribe(dbInstance => {
  //         if (dbInstance.attributes) {
  //           let dbIdInstanceAtts = dbInstance.attributes;
  //           let structuralAttributes = ['hasEvent', 'input', 'output', 'catalystActivity', 'regulatedBy'];
  //           for (let attName of dbIdInstanceAtts.keys()) {
  //             if (structuralAttributes.includes(attName)) {
  //               let attValue = dbIdInstanceAtts.get(attName);
  //               if (attValue) {
  //                 if (attValue instanceof Array) {
  //                   for (let val of attValue) {
  //                     if (deletedDbIds.includes(val.dbId)) {
  //                       this.reviewStatusCheck.handleReviewStatus(instanceCopy, attName);
  //                       break;
  //                     }
  //                   }
  //                 }
  //                 else {
  //                   if (deletedDbIds.includes(attValue.dbId)) {
  //                     this.reviewStatusCheck.handleReviewStatus(instanceCopy, attValue.attribute.name);
  //                   }
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       })
  //     }),
  //     take(1)
  //   ).subscribe();
  //   return instanceCopy;
  // }
}
