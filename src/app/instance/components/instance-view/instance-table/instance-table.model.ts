/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { Observable, of } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, SchemaAttribute } from "src/app/core/models/reactome-schema.model";

/**
 * Used to encode the data for the attribute value cell.
 */
export interface AttributeValue {
  attribute: SchemaAttribute,
  value: any,
  index?: number // index of the value for an multi-valued slot
  editAction?: EDIT_ACTION // May be used to encode editing action
  referenceValue?: any // To be used for comparison
}

export interface DragDropStatus {
  dragging: boolean,
  dropping: boolean,
  draggedInstance: Instance | undefined
}

export enum EDIT_ACTION {
  ADD_NEW,
  ADD_VIA_SELECT,
  DELETE,
  EDIT,
  BOOKMARK
}

/**
 * Customize a DataSource so that we can use an Instance object directly for table display.
 */
export class InstanceDataSource extends DataSource<AttributeValue> {

  constructor(private instance: Instance | undefined,
              private categories: Map<AttributeCategory, boolean>,
              public sort: boolean,
              public sortAttDefined: boolean,
              public filterEdited: boolean,
              private referenceInstance?: Instance) {
    super();
  }

  override connect(): Observable<AttributeValue[]> {
    const attributeValues: AttributeValue[] = [];
    // This is weird. Not sure why. Just manually check here
    if (this.instance?.attributes) {
      for (let attribute of this.instance!.schemaClass!.attributes!) {
        let value = this.instance!.attributes!.get(attribute.name);
        if (this.categories.get(attribute.category)) {
          const attributeValue: AttributeValue = {
            attribute: attribute,
            value: value
          };
          if (this.referenceInstance !== undefined) {
            attributeValue.referenceValue = this.referenceInstance.attributes!.get(attribute.name);
          }
          attributeValues.push(attributeValue);
        }
      }
      if(this.instance?.modifiedAttributes) {
        for (let attribute of this.instance.modifiedAttributes) {
          let value = this.instance.modifiedAttributes.get(attribute);
        }

      }

      // Only show attributes that have been edited
      if(this.filterEdited) {
        let editedAtts: AttributeValue[] = [];
        console.log(this.instance.modifiedAttributes)
        attributeValues.forEach(att => {
          if(this.instance?.modifiedAttributes.get(att.attribute.name)){
            console.log(att.attribute.name)
            editedAtts.push(att);
          }
        })
        return of(editedAtts);
      }

      // Sort attributes alphabetically by name ascending, otherwise descending.
      if (this.sort) {
        attributeValues.sort((a, b) => a.attribute.name.localeCompare(b.attribute.name));
      } else {
        attributeValues.sort((a, b) => b.attribute.name.localeCompare(a.attribute.name));
      }

      // The sort of definingType is based on the numeric index of AttributeDefiningType
      if (this.sortAttDefined) {
        attributeValues.sort((a, b) => a.attribute.definingType < b.attribute.definingType ?
          -1 : 1)
      }
    }
    return of(attributeValues);
  }

  override disconnect(): void {
  }

}
