import {AfterViewInit, Component, Input} from '@angular/core';
import {Store} from '@ngrx/store';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {InstanceActions} from 'src/app/instance/state/instance.actions';
import {AttributeCategory, AttributeDataType, SchemaAttribute} from "../../../../core/models/reactome-schema.model";
import {
  SelectInstanceDialogService
} from "../../../../list-instances/components/select-instance-dialog/select-instance-dialog.service";
import {NewInstanceDialogService} from '../../new-instance-dialog/new-instance-dialog.service';
import {AttributeValue, EDIT_ACTION, InstanceDataSource} from './instance-table.model';
import {DragDropService} from "../../../../instance-bookmark/drag-drop.service";
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDropList,
  moveItemInArray,
  transferArrayItem
} from "@angular/cdk/drag-drop";
import {elementAt, OperatorFunction} from "rxjs";


/**
 * This is the actual table component to show the content of an Instance.
 */
@Component({
  selector: 'app-instance-table',
  templateUrl: './instance-table.component.html',
  styleUrls: ['./instance-table.component.scss'],
})
export class InstanceTableComponent {
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

  // For highlighting rows during drag/drop event
  canDropAttribute: Map<string, string> = new Map<string, string>();
  drag = false;
  dropping = false;

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
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store) {
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
    this.addModifiedAttributeName(data.attribute.name);

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
    // Change in this type of attribute doesn't need to update the table content.
    // Therefore, we need to register it here
    this.registerUpdatedInstance();
    this.dropping = false;
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

  private deleteInstanceAttribute(attributeValue: AttributeValue): void {
    console.debug('deleteInstanceAttribute: ', attributeValue);
    this.addModifiedAttributeName(attributeValue.attribute.name);
    if (attributeValue.attribute.cardinality === '1') {
      // This should not occur. Just in case
      this._instance?.attributes?.delete(attributeValue.attribute?.name);
    } else {
      // This should be a list
      const valueList: [] = this._instance?.attributes?.get(attributeValue.attribute.name);
      // Remove the value
      valueList.splice(attributeValue.index!, 1);
    }
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
      //TODO: Add a new value may reset the scroll position. This needs to be changed!
      this.updateTableContent();
      //Only add attribute name if value was added
      this.addModifiedAttributeName(attributeValue.attribute.name);
    });
  }

  addBookmarkedInstance(attributeValue: AttributeValue) {
    if(this.dropping) {
      let result = attributeValue.value; //Only one value emitted at once
      this.addValueToAttribute(attributeValue, result);
      this.drag = false;
    }
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
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
    // Only add attribute name if value was added
    this.addModifiedAttributeName(attributeValue.attribute.name);
  }

  updateTableContent(): void {
    this.instanceDataSource = new InstanceDataSource(this._instance,
      this.categories,
      this.sortAttNames,
      this.sortAttDefined,
      this._referenceInstance);
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

  private addModifiedAttributeName(attName: string) {
    // Do nothing if there is no instance
    if (this._instance === undefined)
      return;
    if (this._instance.modifiedAttributes == undefined)
      this._instance.modifiedAttributes = [attName];
    else if (!this._instance.modifiedAttributes.includes(attName))
      // Somehow ngrx/store make modifiedAttributes immutable
      this._instance.modifiedAttributes.push(attName);
  }

  drop(event: CdkDragDrop<string[]>, value: SchemaAttribute) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
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


  canDrop(dragging: boolean) {
    this.drag = dragging;
  }

  protected readonly AttributeCategory = AttributeCategory;
  protected readonly undefined = undefined;

  bookmarkDrop(event: CdkDragDrop<Instance | undefined>) {
    this.dropping = true;
    this.drag = false;
  }

  dragEntering($event: CdkDragEnter<Instance | undefined>) {
    console.log("event", $event)
    this.drag = true;
    this.draggedInstance = $event.item.data;
  }
}
