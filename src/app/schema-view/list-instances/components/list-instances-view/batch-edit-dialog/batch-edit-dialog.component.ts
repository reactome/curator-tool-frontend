import { Component, Inject } from '@angular/core';
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
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { AttributeListDialogService } from './attribute-list-dialog/attribute-list-dialog.service';
import { MatSelect } from '@angular/material/select';
import { take, map, of } from 'rxjs';
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
  selectedInstances: Instance[] = [];
  isSingleValued: boolean = false;
  attributeSchemaClass: string = '';
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.CLOSE];
  removedActionButtons: Array<ActionButton> = [ACTION_BUTTONS.UNDO];
  attributeSelected: boolean = false;
  batchEditOptions: string[] = ['Add', 'Set', 'Remove'];
  removedInstances: Instance[] = [];
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
    public dialogRef: MatDialogRef<BatchEditDialogComponent, void>,
    private dataService: DataService,
    private newInstanceDialogService: NewInstanceDialogService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private attributeEditService: AttributeEditService,
    private postEditService: PostEditService,
    private instUtil: InstanceUtilities,
    private attributeListDialogService: AttributeListDialogService,

  ) {
    // Initialize the list of attributes based on the schema classes of the instances
    this.setCandidateAttributes();

  }

  onClose() {
    this.dialogRef.close();
  }

  get selectedValuesForReplace(): any[] {
    return Array.from(this.selectedAggregatedValues).map((value) => value?.value);
  }

  formatReplaceValue(value: any): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (value?.displayName) {
      return value.displayName;
    }
    return value.toString?.() ?? String(value);
  }

  openInNewTab(instance: Instance) {
    window.open(`/schema_view/instance/${instance.dbId}`, '_blank');
  }

  handleListTableAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      // To remove an instance from the batch edit list
      case "close": {
        if (!this.removedInstances.some(inst => inst.dbId === actionButton.instance.dbId)) {
          this.removedInstances.push(actionButton.instance);
          this.removedInstances = [...this.removedInstances];
        }
        this.data = this.data.filter(inst => inst.dbId !== actionButton.instance.dbId);
        break;
      }
    }
  }

  handleRemovedTableAction(actionButton: { instance: Instance, action: string }) {
    if (actionButton.action !== ACTION_BUTTONS.UNDO.name)
      return;
    this.removedInstances = this.removedInstances.filter(inst => inst.dbId !== actionButton.instance.dbId);
    if (!this.data.some(inst => inst.dbId === actionButton.instance.dbId)) {
      this.data = [...this.data, actionButton.instance];
    }
  }

  handleAttributeSelectionChange(selection: MatSelect): void {
    this.selectedAttribute = undefined;
    this.attributeSelected = true;
    this.selectedAggregatedValues.clear();
    this.selectedAttribute = this.candidateAttributes.find(attr => attr === selection.value);
    this.aggregateAttributes();
    console.debug('selected', this.selectedAttribute);
  }

  private setCandidateAttributes() {
    // unique list of the schema classes found in the data list 
    let schemaClasses: Set<string> = new Set(this.data.map(inst => inst.schemaClassName));
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
        if (!arr || arr.length === 0) {
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
      const nonEmptyArrayCount = attributeArrays.filter(arr => arr && arr.length > 0).length;
      if (nonEmptyArrayCount === 0) {
        return;
      }
      for (let attr of nameFrequency) {
        if (attr[1] === nonEmptyArrayCount) {
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
      if (this.storeAggregatedAttributes && this.storeAggregatedAttributes.size !== 0) {
        const matDialogRef = this.attributeListDialogService.openDialog(this.selectedAttribute!.name, Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          this.selectedAggregatedValues.clear();
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
      const attributesToReplace = Array.from(this.selectedAggregatedValues).map((values) => ({
        attribute: this.selectedAttribute!,
        value: values.value,
      } as AttributeValue));
      this.addAttributes(attributesToReplace, attributeValue.value, replace);
    }
    else {
      this.addAttribute(attributeValue, attributeValue.value, replace);

    }

  }

  onBooleanAttributeEdit(attributeValue: AttributeValue) {

    this.addAttribute(attributeValue, attributeValue.value, true);
  }

  // Used for non-instance attribute edits in the dialog body (boolean/integer/float/string replacement).
  onScalarAttributeEdit(attributeValue: AttributeValue) {
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

  private addNewInstanceAttribute(attributeValue: AttributeValue, replace: boolean = false): void {
    // if replacing then populate the attributeValue with the selected value from 
    // the aggregated attributes dialog 
    if (replace) {
      if (this.storeAggregatedAttributes && this.storeAggregatedAttributes.size !== 0) {
        const matDialogRef = this.attributeListDialogService.openDialog(this.selectedAttribute!.name, Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          this.selectedAggregatedValues.clear();
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
            const attributesToReplace = Array.from(this.selectedAggregatedValues).map((values) => ({
              attribute: this.selectedAttribute!,
              value: values.value,
            } as AttributeValue));
            this.addAttributes(attributesToReplace, result, replace);

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
      if (this.storeAggregatedAttributes && this.storeAggregatedAttributes.size !== 0) {
        const matDialogRef = this.attributeListDialogService.openDialog(this.selectedAttribute!.name, Array.from(this.storeAggregatedAttributes));
        matDialogRef.afterClosed().subscribe((values) => {
          values = values || [];
          this.selectedAggregatedValues.clear();
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
            const attributesToReplace = Array.from(this.selectedAggregatedValues).map((values) => ({
              attribute: this.selectedAttribute!,
              value: values.value,
            } as AttributeValue));
            this.addAttributes(attributesToReplace, result, replace);

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
    this.addAttributes([attributeValue], result, replace);
  }

  private addAttributes(attributeValues: AttributeValue[], result: any, replace: boolean) {
    if (!attributeValues || attributeValues.length === 0) {
      return;
    }

    this.getInstancesForEdit().pipe(take(1)).subscribe((instances: Instance[]) => {
      const isInstanceAttribute = attributeValues[0].attribute.type === this.DATA_TYPES.INSTANCE;

      for (let instance of instances) {
        for (let attributeValue of attributeValues) {
          if (replace && !this.matchesReplaceTarget(instance, attributeValue)) {
            continue;
          }

          if (isInstanceAttribute) {
            if (result?.dbId < 0)
              this.attributeEditService.addValueToAttribute(attributeValue, result, instance, replace);
            else
              this.attributeEditService.addInstanceViaSelect(attributeValue, result, instance, replace);
          }
          else {
            this.attributeEditService.onNoInstanceAttributeEdit(attributeValue, result, instance, replace);
          }

          this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
        }
      }
    });
  }

  private getInstancesForEdit(): Observable<Instance[]> {
    const currentDbIds = new Set(this.data.map(inst => inst.dbId));

    if (this._instances && this._instances.length > 0) {
      const cachedDbIds = new Set(this._instances.map(inst => inst.dbId));
      const hasAllRequestedInstances = Array.from(currentDbIds).every(dbId => cachedDbIds.has(dbId));

      if (hasAllRequestedInstances) {
        return of(this._instances.filter(instance => currentDbIds.has(instance.dbId)));
      }
    }

    return this.dataService.fetchInstanceInBatch(Array.from(currentDbIds)).pipe(
      map((objects: Instance[]) => {
        this._instances = [...objects];
        return this._instances;
      })
    );
  }

  private matchesReplaceTarget(instance: Instance, attributeValue: AttributeValue): boolean {
    const existingValue = instance.attributes.get(attributeValue.attribute.name);

    if (Array.isArray(existingValue)) {
      const targetValue = attributeValue.value;
      const index = existingValue.findIndex((val: any) => val == targetValue || val?.toString?.() === targetValue?.toString?.());
      if (index === -1) {
        return false;
      }

      attributeValue.index = index;
      return true;
    }

    if (existingValue !== undefined && (existingValue === attributeValue.value || existingValue?.toString?.() === attributeValue.value?.toString?.())) {
      return true;
    }

    return false;
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    if (this.storeAggregatedAttributes && this.storeAggregatedAttributes.size !== 0) {
      const matDialogRef = this.attributeListDialogService.openDialog(this.selectedAttribute!.name, Array.from(this.storeAggregatedAttributes));
      matDialogRef.afterClosed().subscribe((values) => {
        values = values || [];
        this.selectedAggregatedValues.clear();
        values.forEach((val) => {
          let att: AttributeValue = {
            attribute: this.selectedAttribute!,
            value: val,
          }
          this.selectedAggregatedValues.add(att);
        });

        this.getInstancesForEdit().pipe(take(1)).subscribe((instances: Instance[]) => {
          this.selectedAggregatedValues.forEach((values) => {
            for (let instance of instances) {
              let att = instance.attributes.get(attributeValue.attribute.name);
              if (att !== undefined) {
                if (Array.isArray(att)) {
                  if (att.includes(values.value)) {
                    let index = att.indexOf(values.value);
                    values.index = index;
                    this.attributeEditService.deleteInstanceAttribute(values, instance);
                    this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
                  }
                }
                else {
                  if (att === values.value) {
                    this.attributeEditService.deleteInstanceAttribute(values, instance);
                    this.finishEdit(attributeValue.attribute.name, attributeValue, instance);
                  }
                }
              }
            }
          });
        });

      });

    }
  }

  finishEdit(attName: string, value: any, instance: Instance) {
    this.refreshDisplayedInstance(instance);
    // Only add attribute name if value was added
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
   * TODO: This has not been finished yet. How to update the display name here if it is really needed?
   * // There should be no need to do this here. The edit will be done after the dialog is closed.
   */
  donePostEdit(instance: Instance, editedAttributeName: string | undefined): boolean {
    this.refreshDisplayedInstance(instance);
    return true;
  }

  private refreshDisplayedInstance(updatedInstance: Instance) {
    const syncDisplayName = (instances: Instance[]) => instances.map(instance =>
      instance.dbId === updatedInstance.dbId
        ? { ...instance, displayName: updatedInstance.displayName }
        : instance
    );

    this.data = syncDisplayName(this.data);
    this.removedInstances = syncDisplayName(this.removedInstances);

    if (this._instances) {
      this._instances = this._instances.map(instance =>
        instance.dbId === updatedInstance.dbId
          ? { ...instance, displayName: updatedInstance.displayName }
          : instance
      );
    }
  }
}