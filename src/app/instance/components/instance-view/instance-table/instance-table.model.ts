/**
 * This script holds classes defined for the instance table.
 */

import {DataSource} from "@angular/cdk/collections";
import {Observable, of} from "rxjs";
import {Instance} from "src/app/core/models/reactome-instance.model";
import {AttributeCategory, AttributeDefiningType, SchemaAttribute} from "src/app/core/models/reactome-schema.model";

/**
 * Used to encode the data for the attribute value cell.
 */
export interface AttributeValue {
  attribute: SchemaAttribute,
  value: any,
  index?: number // index of the value for an multi-valued slot
  editAction?: EDIT_ACTION // May be used to encode editing action:
}

export enum EDIT_ACTION {
  ADD_NEW,
  ADD_VIA_SELECT,
  DELETE,
  EDIT,
  TEST_DELETE
}

/**
 * Customize a DataSource so that we can use an Instance object directly for table display.
 */
export class InstanceDataSource extends DataSource<AttributeValue> {

  constructor(private instance: Instance | undefined, private categories: Map<AttributeCategory, boolean>, public sort: boolean, public sortAttDefined: boolean) {
    super();
  }

  override connect(): Observable<AttributeValue[]> {
    const attributeValues: AttributeValue[] = [];
    // This is weird. Not sure why. Just manually check here
    if (this.instance?.attributes) {
      for (let attribute of this.instance!.schemaClass!.attributes!) {
        let value = this.instance!.attributes!.get(attribute.name);
        if (this.categories.get(attribute.category)) {
          const attributeValue = {
            attribute: attribute,
            value: value
          };
          attributeValues.push(attributeValue);
        }
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
