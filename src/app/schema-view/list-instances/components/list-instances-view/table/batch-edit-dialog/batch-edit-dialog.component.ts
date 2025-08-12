import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS, AttributeCategory, SchemaAttribute, SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { SelectInstanceDialogComponent } from '../../../select-instance-dialog/select-instance-dialog.component';
import { ActionButton } from '../instance-list-table/instance-list-table.component';
import { DataService } from 'src/app/core/services/data.service';
import { Observable } from 'rxjs/internal/Observable';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';
import { AttributeValue, EDIT_ACTION } from 'src/app/instance/components/instance-view/instance-table/instance-table.model';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { SelectInstanceDialogService } from '../../../select-instance-dialog/select-instance-dialog.service';
import { NewInstanceDialogService } from 'src/app/instance/components/new-instance-dialog/new-instance-dialog.service';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Store } from '@ngrx/store';

@Component({
  selector: 'app-batch-edit-dialog',
  templateUrl: './batch-edit-dialog.component.html',
  styleUrls: ['./batch-edit-dialog.component.scss']
})
export class BatchEditDialogComponent implements PostEditListener {
  selectedAttribute: SchemaAttribute | undefined;
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

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: Instance[],
    public dialogRef: MatDialogRef<SelectInstanceDialogComponent>,
    private dataService: DataService,
    private dialogService: NewInstanceDialogService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private attributeEditService: AttributeEditService,
    private postEditService: PostEditService,
    private instUtil: InstanceUtilities,
    private store: Store,

  ) {
    this.setCandidateAttributes();
  }

  onSelectRow(row: Instance) {
    if (this.isSingleValued) {
      // Only take one value if the cardinality is 1
      this.selectedInstances = [row];
    }
    // input, output, and hasComponent may have multiple values (ex: ATP)
    else if (this.attributeSchemaClass === 'input' ||
      this.attributeSchemaClass === 'output' ||
      this.attributeSchemaClass === 'hasComponent') {
      this.selectedInstances = [...this.selectedInstances, row];
    }
    else {
      this.selectedInstances = [...this.selectedInstances, row];
      let noDuplicates: Instance[] = [];
      this.selectedInstances.forEach(element => {
        if (!noDuplicates.includes(element)) {
          noDuplicates.push(element);
        }
      });
      this.selectedInstances = noDuplicates;
    }
  }

  onSelectionChange(att: SchemaAttribute): void {
    this.selectedAttribute = undefined;
    this.attributeSelected = true;
    this.selectedAttribute = this.candidateAttributes.find(attr => attr === att);
    console.log('selected' + this.selectedAttribute);
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close();
  }

  onRemoveEvent(instance: Instance) {
    this.removedInstances.push(instance);
  }

  setCandidateAttributes() {
    // unique list of the schema classes found in the data list 
    let schemaClasses: Set<string> = new Set(this.data.map(inst => inst.schemaClassName));
    this.grepAttributes(schemaClasses);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      case "close": {
        this.onRemoveEvent(actionButton.instance);
        break;
      }
    }
  }

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

      // Optional: sort by name
      this.candidateAttributes.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  onAddEvent(e: AttributeValue) {

  }
  onSetEvent(e: AttributeValue) {
    // Handle the event when an attribute is set
    console.log('Attribute set:', e);

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
      default:
        console.error("The action doesn't know: ", attributeValue.editAction);
    }
  }

  private addNewInstanceAttribute(attributeValue: AttributeValue, replace: boolean = false
  ): void {
    const matDialogRef = this.dialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
            this.dataService.fetchInstanceInBatch(this.data.map(inst => inst.dbId)).subscribe((objects: Instance[]) => {
        this._instances = [...objects]; // for editing
        for (let instance of this._instances) {
          this.attributeEditService.addValueToAttribute(attributeValue, result, instance, replace);
          this.finishEdit(attributeValue.attribute.name, result, instance);
        }
      });
    });
  }

  private addInstanceViaSelect(attributeValue: AttributeValue, replace: boolean = false) {
    const matDialogRef =
      this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      if (!result || result.length === 0)
        return;
      this.dataService.fetchInstanceInBatch(this.data.map(inst => inst.dbId)).subscribe((objects: Instance[]) => {
        this._instances = [...objects]; // for editing
        for (let instance of this._instances) {
          this.attributeEditService.addInstanceViaSelect(attributeValue, result, instance, replace);
          this.finishEdit(attributeValue.attribute.name, result, instance);
        }
      });
    });
  }

  onNoInstanceAttributeEdit(data: AttributeValue) {
    this.attributeEditService.onNoInstanceAttributeEdit(data, this.tempInstance!);
  }

  finishEdit(attName: string, value: any, instance: Instance) {
    //Only add attribute name if value was added
    this.postEdit(attName, instance);
    // Need to call this before registerUpdatedInstance
    // in case the instance is used somewhere via the ngrx statement management system
    this.addModifiedAttribute(attName, value, instance);
    // Register the updated instances
    this.registerUpdatedInstance(attName, instance);
  }

  private addModifiedAttribute(attributeName: string, attributeVal: any, instance: Instance) {
    // Do nothing if there is no instance
    if (instance === undefined) return;
    if (instance.modifiedAttributes === undefined) {
      instance.modifiedAttributes = [];
    }
    if (!instance.modifiedAttributes.includes(attributeName))
      instance.modifiedAttributes.push(attributeName);
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    this.dataService.fetchInstanceInBatch(this.data.map(inst => inst.dbId)).subscribe((objects: Instance[]) => {
      this._instances = [...objects]; // for editing
      for (let instance of this._instances) {
        this.attributeEditService.deleteInstanceAttribute(attributeValue, instance);
        this.finishEdit(attributeValue.attribute.name, attributeValue.value, instance);
      }
    });
  }

  private registerUpdatedInstance(attName: string, instance: Instance): void {

    let cloned: Instance = this.instUtil.makeShell(instance);
    if (instance!.dbId > 0) {
      // Have to make a clone to avoid any change to the current _instance!
      this.store.dispatch(UpdateInstanceActions.register_updated_instance(cloned));
    } else {
      // Force the state to update if needed
      this.store.dispatch(NewInstanceActions.register_new_instance(cloned));
    }
    this.store.dispatch(UpdateInstanceActions.last_updated_instance({ attribute: attName, instance: cloned }));
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