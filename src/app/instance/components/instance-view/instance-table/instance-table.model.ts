/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { Observable, of } from "rxjs";
import { AttributeValue, Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, SchemaAttribute } from "src/app/core/models/reactome-schema.model";


export interface DragDropStatus {
  dragging: boolean,
  dropping: boolean,
  draggedInstance: Instance | undefined
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
    // Just in case
    let instAtts = this.instance?.attributes;
    if (!instAtts)
      instAtts = new Map();
    // This is weird. Not sure why. Just manually check here
    if (this.instance?.schemaClass?.attributes) {
      for (let attribute of this.instance.schemaClass.attributes) {
        let value = instAtts.get(attribute.name);
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
      // Only show attributes that have been edited
      if(this.filterEdited) {
        let editedAtts: AttributeValue[] = [];
        attributeValues.forEach(att => {
          if(this.instance?.modifiedAttributes?.includes(att.attribute.name) || this.instance?.passiveModifiedAttributes?.includes(att.attribute.name)) {
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
