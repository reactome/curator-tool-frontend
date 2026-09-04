/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { BehaviorSubject, Observable } from "rxjs";
import { AttributeValue, Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, SchemaAttribute } from "src/app/core/models/reactome-schema.model";


export interface DragDropStatus {
  dragging: boolean,
  dropping: boolean,
  draggedInstance: Instance | undefined
}

/**
 * Reported by a value row element as the cursor moves over it during a bookmark drag. The table
 * uses it to highlight the whole attribute slot rather than only the value under the cursor: a
 * multi-valued slot is a single drop target, so lighting up one of its values is misleading.
 */
export interface DragHoverStatus {
  attribute: SchemaAttribute,
  // Whether the cursor entered (true) or left (false) this value
  hovered: boolean,
  // Whether the instance being dragged is accepted by this attribute
  droppable: boolean
}


/**
 * Customize a DataSource so that we can use an Instance object directly for table display.
 */
export class InstanceDataSource extends DataSource<AttributeValue> {

  /**
   * Rows are pushed through a subject rather than handed out as a fresh `of(...)` per connect, so
   * that the content can be refreshed without the table having to swap the DataSource itself.
   * Swapping it makes CdkTable diff an entirely new set of rows, which destroys every row and
   * re-creates it; tearing down that many rows forces a layout while the table body is
   * momentarily empty, and the browser then clamps the scroll position to the top. That is what
   * put a curator back at the top of a long instance after each edit. See refresh().
   */
  private readonly rows = new BehaviorSubject<AttributeValue[]>([]);

  constructor(private instance: Instance | undefined,
              private categories: Map<AttributeCategory, boolean>,
              public sort: boolean,
              public sortAttDefined: boolean,
              public filterEdited: boolean,
              private referenceInstance?: Instance) {
    super();
  }

  override connect(): Observable<AttributeValue[]> {
    this.rows.next(this.buildRows());
    return this.rows.asObservable();
  }

  /**
   * Recompute the rows and push them to the table, which diffs them against what it is already
   * showing (keyed by attribute name - see InstanceTableComponent.trackByAttributeName) and
   * updates the affected rows in place instead of rebuilding all of them.
   */
  refresh(instance: Instance | undefined, referenceInstance?: Instance): void {
    this.instance = instance;
    this.referenceInstance = referenceInstance;
    this.rows.next(this.buildRows());
  }

  private buildRows(): AttributeValue[] {
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
        return editedAtts;
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
    return attributeValues;
  }

  override disconnect(): void {
  }

}
