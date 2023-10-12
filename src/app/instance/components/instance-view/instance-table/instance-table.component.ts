import {Component, Input} from '@angular/core';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {NewInstanceDialogService} from '../../new-instance-dialog/new-instance-dialog.service';
import {AttributeValue, EDIT_ACTION, InstanceDataSource} from './instance-table.model';
import {AttributeCategory, SchemaAttribute} from "../../../../core/models/reactome-schema.model";

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
  showFilter: boolean = false;
  showSort: boolean = false;
  sortAttNames: boolean = true;
  test: boolean = true;

  categoryNames = Object.keys(AttributeCategory).filter((v) => isNaN(Number(v)));
  categories: { [name: string]: boolean } = {};

  // The instance to be displayed
  instanceDataSource: InstanceDataSource = new InstanceDataSource(undefined, this.categories, this.sortAttNames);
  // Keep it for editing
  _instance?: Instance;
  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    this._instance = instance;
    for(let category of this.categoryNames){ this.categories[category] = true}
    console.log(this.categories)
    this.updateTableContent();
  };

  constructor(
    private dialogService: NewInstanceDialogService) {} // Use a dialog serice to hide the implementation of the dialog.

  changeShowFilterOptions() {
    this.showFilterOptions = !this.showFilterOptions;
  }

  changeShowFilter() {
    this.showFilter = ! this.showFilter;
  }

  changeShowSort() {
    this.showSort = !this.showSort;
  }

  doFilter() {
    this.updateTableContent();
  }

  sort() {
    this.sortAttNames = !this.sortAttNames;
    this.updateTableContent();
  }

  onNoInstanceAttributeEdit(data: AttributeValue) {
    console.debug('onNewValue: ', data);
    if (data.attribute.cardinality === '1') {
      this._instance?.attributes?.set(data.attribute.name, data.value);
    }
    else { // This should be a list
      let valueList = this._instance?.attributes!.get(data.attribute.name);
      if (valueList === undefined) {
        this._instance?.attributes?.set(data.attribute.name, [data.value]);
      }
      else {
        valueList[data.index!] = data.value;
      }
    }
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
      default:
        console.error("The action doesn't know: ", attributeValue.editAction);
    }
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue): void {
    console.debug('deleteInstanceAttribute: ', attributeValue);
    if (attributeValue.attribute.cardinality === '1') {
      // This should not occur. Just in case
      this._instance?.attributes?.delete(attributeValue.attribute?.name);
    }
    else {
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
      let value = this._instance?.attributes?.get(attributeValue.attribute.name);
      if (value === undefined) {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') {
          this._instance?.attributes?.set(attributeValue.attribute.name, result);
        }
        else {
          this._instance?.attributes?.set(attributeValue.attribute.name, [result]);
        }
      }
      else {
        // It should be the first
        if (attributeValue.attribute.cardinality === '1') { // Make sure only one value used
          this._instance?.attributes?.set(attributeValue.attribute.name, result);
        }
        else {
          value.splice(attributeValue.index, 0, result);
        }
      }
      //TODO: Add a new value may reset the scroll position. This needs to be changed!
      this.updateTableContent();
    });
  }

  private updateTableContent(): void {
    this.instanceDataSource = new InstanceDataSource(this._instance, this.categories, this.sortAttNames);
  }

  protected readonly AttributeCategory = AttributeCategory;
  protected readonly Object = Object;
}
