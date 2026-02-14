import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AttributeValue, EDIT_ACTION, Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS, AttributeCategory, AttributeDataType, SchemaAttribute, SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { Observable } from 'rxjs/internal/Observable';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { NewInstanceDialogService } from 'src/app/instance/components/new-instance-dialog/new-instance-dialog.service';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Store } from '@ngrx/store';
import { AttributeListDialogService } from './attribute-list-dialog/attribute-list-dialog.service';
import { MatSelect } from '@angular/material/select';
import { take, map } from 'rxjs';
import { deleteInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { SelectInstanceDialogService } from '../../select-instance-dialog/select-instance-dialog.service';
import { ActionButton } from '../instance-list-table/instance-list-table.component';

@Component({
  selector: 'app-batch-edit-dialog',
  templateUrl: './batch-edit-dialog.component.html',
  styleUrls: ['./batch-edit-dialog.component.scss']
})
export class BatchEditDialogComponent implements PostEditListener {
  selectedAttribute: SchemaAttribute | undefined;
  selectedAction: EDIT_ACTION | undefined;
  selected: string = '';
  candidateAttributes: SchemaAttribute[] = [];
  instance: Instance | undefined;
  selectedInstances: Instance[] = [];
  isSingleValued: boolean = false;
  attributeSchemaClass: string = '';
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.CLOSE];
  attributeSelected: boolean = false;
  batchEditOptions: string[] = ['Add', 'Set', 'Remove'];
  removedInstances: Instance[] = [];
  element: any;
  dragDropStatus: any;
  blockRouter: any;
  tempInstance: Instance | undefined;
  _instances: Instance[] | undefined;
  textAttributeValue: AttributeValue | undefined;
  selectedAggregatedValues: Set<any> = new Set();
  storeAggregatedAttributes: Set<any> = new Set();
  deletedDBIds: number[] = [];
  updatedDBIds: number[] = [];

  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  EDIT_ACTION = EDIT_ACTION;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: Instance[],
    public dialogRef: MatDialogRef<BatchEditDialogComponent>,
    private dataService: DataService,
    private newInstanceDialogService: NewInstanceDialogService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private attributeEditService: AttributeEditService,
    private postEditService: PostEditService,
    private instUtil: InstanceUtilities,
    private store: Store,
    private attributeListDialogService: AttributeListDialogService,

  ) {
    // Initialize the list of attributes based on the schema classes of the instances
    this.setCandidateAttributes();

  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close();
  }

  handleListTableAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      // To remove an instance from the batch edit list
      case "close": {
        this.removedInstances.push(actionButton.instance);
        this.removedInstances = [...this.removedInstances];
        this.data = this.data.filter(inst => inst.dbId !== actionButton.instance.dbId);
        break;
      }
    }
  }

  handleAttributeSelectionChange(selection: MatSelect): void {
    this.selectedAttribute = undefined;
    this.attributeSelected = true;
    this.selectedAttribute = this.candidateAttributes.find(attr => attr === selection.value);
    this.aggregateAttributes();
    console.debug('selected', this.selectedAttribute);
  }

  setCandidateAttributes() {
    // unique list of the schema classes found in the data list 
    let schemaClasses: Set<string> = new Set(this.data.map(inst => inst.schemaClassName));
    this.grepAttributes(schemaClasses);
  }

  // Find the common attributes among the given schema classes
  private grepAttributes(schemaClasses: Set<string>): void {
    let attributeArrays: SchemaAttribute[][] = [];
    let fetches: Array<Observable<SchemaClass>> = [];

    for (let schemaClass of schemaClasses) {
      fetches.push(this.dataService.fetchSchemaClass(schemaClass));
    }

    forkJoin(fetches).subscribe(classes => {
      for (const clazz of classes) {
        // Exclude attributes with NOMANUALEDIT
        const attributes = clazz.attributes?.filter(attr => !attr.category || attr.category !== AttributeCategory.NOMANUALEDIT);
        if (attributes) {
          attributeArrays.push(attributes);
        }
      }

      if (attributeArrays.length === 0) {
        this.candidateAttributes = [];
        return;
      }

      // Count occurrences of each attribute name
      const nameCount = new Map<string, SchemaAttribute>();
      const nameFrequency = new Map<string, number>();

      attributeArrays.forEach(arr => {
        if (arr === undefined || arr.length === 0) {
          attributeArrays.splice(attributeArrays.indexOf(arr), 1);
          console.warn('Empty or undefined attribute array found, skipping...');
          return;
        }
        arr.forEach(attr => {
          if (!nameCount.has(attr.name)) {
            nameCount.set(attr.name, attr);
          }
          nameFrequency.set(attr.name, (nameFrequency.get(attr.name) || 0) + 1);
        });
      });

      // Only keep attributes present in all arrays
      this.candidateAttributes = [];
      for (let attr of nameFrequency) {
        if (attr[1] === attributeArrays.length) {
          this.candidateAttributes.push(nameCount.get(attr[0])!);
        }
      }

      // sort by name
      this.candidateAttributes.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  // Edit actions returned from the attribute edit component for instance attributes
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
      default:
        console.error("The action doesn't know: ", attributeValue.editAction);
    }
  }

  // Edit actions returned from the action menu for text attributes
  // TODO: collect the values that are selected from the aggregated attributes dialog
  onEditAction(attributeValue: AttributeValue) {
    console.debug("onEditAction: ", attributeValue);
    switch (this.selectedAction) {
      case EDIT_ACTION.DELETE:
        this.onNonInstanceAttributeEdit(attributeValue, true);
        break;
      case EDIT_ACTION.ADD_NEW:
        this.onNonInstanceAttributeEdit(attributeValue, false);
        break;

      case EDIT_ACTION.REPLACE_NEW:
        this.onNonInstanceAttributeEdit(attributeValue, true);
        break;
      default:
        console.error("The action doesn't know: ", this.selectedAction);
    }
  }
  onSelectTextAction(action: EDIT_ACTION) {
    if (action === EDIT_ACTION.DELETE || action === EDIT_ACTION.REPLACE_NEW) {
      if (this.storeAggregatedAttributes.size !== 0 || this.storeAggregatedAttributes !== undefined) {
        const matDialogRef = this.attributeListDialogService.openDialog(Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          values.forEach((val) => {
            let att: AttributeValue = {
              attribute: this.selectedAttribute!,
              value: val,
            }
            this.selectedAggregatedValues.add(att);
          });
          // Set the action only after dialog closes
          this.selectedAction = action;
          if (action === EDIT_ACTION.DELETE) {
            this.onEditAction({ attribute: this.selectedAttribute!, value: '', editAction: EDIT_ACTION.DELETE });
          }
        });
        return; // Prevent setting selectedAction immediately
      }
    }
    // Set the action immediately for other cases
    this.selectedAction = action;
  }

  onNonInstanceAttributeEdit(attributeValue: AttributeValue, replace: boolean = false) {
    if (replace) {
      // should only have selected on value to replace so create only one attribute value
      this.selectedAggregatedValues.forEach((values) => {
        let att: AttributeValue = {
          attribute: this.selectedAttribute!,
          value: values.value,
        }
        this.addAttribute(att, attributeValue.value, replace);
      });
    }
    else {
      this.addAttribute(attributeValue, attributeValue.value, replace);

    }

  }

  onBooleanAttributeEdit(attributeValue: AttributeValue) {

    this.addAttribute(attributeValue, attributeValue.value, true);
  }

  private aggregateAttributes() {
    this.dataService.fetchInstanceInBatch(this.data.map(inst => inst.dbId)).subscribe((objects: any[]) => {
      this._instances = [...objects]; // for editing
      let aggregatedAttributes: Set<any> = new Set();
      for (let instance of this._instances) {
        let att = instance.attributes.get(this.selectedAttribute!.name);
        if (att !== undefined) {
          // If the attribute is an array, we need to flatten it
          if (att instanceof Array) {
            for (let value of att) {
              aggregatedAttributes.add(value);
            }
          } else {
            aggregatedAttributes.add(att);
          }
        }
      }
      this.storeAggregatedAttributes = new Set(aggregatedAttributes);

    });
  }

  private addNewInstanceAttribute(attributeValue: AttributeValue, replace: boolean = false
  ): void {
    // if replacing then populate the attributeValue with the selected value from 
    // the aggregated attributes dialog 
    if (replace) {
      if (this.storeAggregatedAttributes.size !== 0 || this.storeAggregatedAttributes !== undefined) {
        const matDialogRef = this.attributeListDialogService.openDialog(Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          values.forEach((val) => {
            let att: AttributeValue = {
              attribute: this.selectedAttribute!,
              value: val,
            }
            this.selectedAggregatedValues.add(att);
          });

          // Open the dialog to create a new instance
          const matDialogRef = this.newInstanceDialogService.openDialog(attributeValue);
          matDialogRef.afterClosed().subscribe((result) => {
            if (!result)
              return;
            // should only have selected on value to replace so create only one attribute value
            this.selectedAggregatedValues.forEach((values) => {
              let att: AttributeValue = {
                attribute: this.selectedAttribute!,
                value: values.value,
              }
              this.addAttribute(att, result, replace);
            });

          });
        });
      }

    }
    else {
      // Open the dialog to create a new instance
      const matDialogRef = this.newInstanceDialogService.openDialog(attributeValue);
      matDialogRef.afterClosed().subscribe((result) => {
        if (!result)
          return;
        this.addAttribute(attributeValue, result, replace);

      });
    }
  }

  private addInstanceViaSelect(attributeValue: AttributeValue, replace: boolean = false) {
    if (replace) {
      if (this.storeAggregatedAttributes.size !== 0 || this.storeAggregatedAttributes !== undefined) {
        const matDialogRef = this.attributeListDialogService.openDialog(Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          values.forEach((val) => {
            let att: AttributeValue = {
              attribute: this.selectedAttribute!,
              value: val,
            }
            this.selectedAggregatedValues.add(att);
          });

          const matDialogRef =
            this.selectInstanceDialogService.openDialog(attributeValue);
          matDialogRef.afterClosed().subscribe((result) => {
            if (!result || result.length === 0)
              return;
            // should only have selected on value to replace so create only one attribute value
            this.selectedAggregatedValues.forEach((values) => {
              let att: AttributeValue = {
                attribute: this.selectedAttribute!,
                value: values.value,
              }
              this.addAttribute(att, result, replace);
            });

          });
        });
      }

    }
    else {
      const matDialogRef =
        this.selectInstanceDialogService.openDialog(attributeValue);
      matDialogRef.afterClosed().subscribe((result) => {
        if (!result || result.length === 0)
          return;
        this.addAttribute(attributeValue, result, replace);
      });
    }
  }

  private addAttribute(attributeValue: AttributeValue, result: any, replace: boolean) {
    this.dataService.fetchInstanceInBatch(this.data.map(inst => inst.dbId)).subscribe((objects: Instance[]) => {
      this._instances = [...objects]; // for editing
      for (let instance of this._instances) {
        // Add the selected instance to the attribut
        // TODO: check if the instance has the attribute if replacing=true, 
        if (replace) {
          let existingValue = instance.attributes.get(attributeValue.attribute.name);
          if (Array.isArray(existingValue)) {
            let contains = existingValue.includes(attributeValue.value) || existingValue.includes(attributeValue.value.toString());
            let index = existingValue.findIndex((val: string) => val == attributeValue.value || val == attributeValue.value.toString());
            if (index === -1) continue; // Value not found, skip to next instance
            attributeValue.index = index; // Store the index for further processing
            // If the attribute is an array, we need to remove the value from the array
            if (attributeValue.attribute.type === this.DATA_TYPES.INSTANCE)
              if (result.dbId < 0)
                this.attributeEditService.addValueToAttribute(attributeValue, result, instance, replace);
              else
                this.attributeEditService.addInstanceViaSelect(attributeValue, result, instance, replace);
            else
              this.attributeEditService.onNoInstanceAttributeEdit(attributeValue, result, instance, replace);
            this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
          }
          else {
            if (existingValue !== undefined && existingValue === attributeValue.value) {
              // If the attribute is a single value, we can delete it directly
              if (attributeValue.attribute.type === this.DATA_TYPES.INSTANCE)
                if (result.dbId < 0)
                  this.attributeEditService.addValueToAttribute(attributeValue, result, instance, replace);
                else
                  this.attributeEditService.addInstanceViaSelect(attributeValue, result, instance, replace);
              else
                this.attributeEditService.onNoInstanceAttributeEdit(attributeValue, result, instance, replace);
              this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
            }
          }
        }
        else {
          if (attributeValue.attribute.type === this.DATA_TYPES.INSTANCE)
            if (result.dbId < 0)
              this.attributeEditService.addValueToAttribute(attributeValue, result, instance, replace);
            else
              this.attributeEditService.addInstanceViaSelect(attributeValue, result, instance, replace); else
            this.attributeEditService.onNoInstanceAttributeEdit(attributeValue, result, instance, replace);
          this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
        }
      }
    });
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    if (this.storeAggregatedAttributes.size !== 0 || this.storeAggregatedAttributes !== undefined) {
      const matDialogRef = this.attributeListDialogService.openDialog(Array.from(this.storeAggregatedAttributes));
      matDialogRef.afterClosed().subscribe((values) => {
        values = values || [];
        values.forEach((val) => {
          let att: AttributeValue = {
            attribute: this.selectedAttribute!,
            value: val,
          }
          this.selectedAggregatedValues.add(att);
        });

        this.selectedAggregatedValues.forEach((values) => {
          // if (values && values.length > 0 && this._instances) {
          //         this.selectedAggregatedValues.forEach((values) => {
          // let att: AttributeValue = {
          //   attribute: this.selectedAttribute!,
          //   value: values.value,
          // }
          for (let instance of this._instances!) {
            let att = instance.attributes.get(attributeValue.attribute.name);
            if (att !== undefined) {
              // for (let value of values) {
              if (Array.isArray(att)) {
                if (att.includes(values.value)) {
                  let index = att.indexOf(values.value);
                  values.index = index; // Store the index for further processing
                  // If the attribute is an array, we need to remove the value from the array
                  this.attributeEditService.deleteInstanceAttribute(values, instance);
                  this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
                }
              }
              else {
                if (att === values.value) {
                  // If the attribute is a single value, we can delete it directly
                  this.attributeEditService.deleteInstanceAttribute(values, instance);
                  this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
                }
              }
              // }
            }
          }
          // }
        });

      });

    }
  }

  finishEdit(attName: string, value: any, instance: Instance) {
    //Only add attribute name if value was added
    this.postEdit(attName, instance);
    // Need to call this before registerUpdatedInstance
    // in case the instance is used somewhere via the ngrx statement management system
    this.instUtil.addToModifiedAttributes(attName, instance);
    // Register the updated instances
    this.instUtil.registerUpdatedInstance(attName, instance);
  }

  isDeleted(row: Instance): boolean {
    return this.deletedDBIds.includes(row.dbId);
  }

  isUpdated(row: Instance): boolean {
    return this.updatedDBIds.includes(row.dbId);
  }

  /**
  * Provide a hook to do something (e.g. update display name, perform QA etc) after
  * any editing.
  * @param attName
  */
  postEdit(attName: string, instance: Instance) {
    if (instance)
      this.postEditService.postEdit(instance, attName, this);
  }

  /**
   * Implementation of PostEditListener interface.
   * Called after post-edit operations.
   */
  donePostEdit(instance: Instance, editedAttributeName: string | undefined): boolean {
    // You can add custom logic here if needed
    return true;
  }
}