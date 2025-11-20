/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { Observable, of } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from "src/app/core/models/reactome-schema.model";

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
    REPLACE_NEW,
    REPLACE_VIA_SELECT,
    DELETE,
    EDIT,
    BOOKMARK
}

/**
 * Customize a DataSource so that we can use an Instance object directly for table display.
 */
export class InstanceComparisonDataSource extends DataSource<AttributeValue> {

    constructor(private instance: Instance | undefined,
        private categories: Map<AttributeCategory, boolean>,
        public sort: boolean,
        public sortAttDefined: boolean,
        public filterEdited: boolean,
        private referenceInstance?: Instance) {
        super();
    }

    override connect(): Observable<AttributeValue[]> {

        // Create a union of attributes from both instance and referenceInstance schema classes
        const allAttributes = new Map<string, SchemaAttribute>();
        for (const attr of this.referenceInstance!.schemaClass!.attributes!) {
            allAttributes.set(attr.name, attr);
        }
        for (const attr of this.instance!.schemaClass!.attributes!) {
            allAttributes.set(attr.name, attr);
        }

        // instance.schemaClass.attributes should be the union of the two instance's attributes
        let attributeValues: AttributeValue[] = [];
        allAttributes.forEach((attribute: SchemaAttribute) => {
            let value = this.instance!.attributes!.get(attribute.name);
            let refValue = this.referenceInstance!.attributes!.get(attribute.name);

            if (this.categories.get(attribute.category)) {
                const attributeValue: AttributeValue = {
                    attribute: attribute,
                    value: value,
                    referenceValue: refValue

                };

                attributeValues.push(attributeValue);
            }
        }
        );
        // Only show attributes that have been edited
        if (this.filterEdited) {
            attributeValues = attributeValues.filter(att => {
                let values = att.value;
                if (!values)
                    values = [];
                if (!Array.isArray(values)) { values = [values]; }
                let referenceValues = att.referenceValue;
                if (!referenceValues)
                    referenceValues = [];
                if (!Array.isArray(referenceValues)) { referenceValues = [referenceValues]; }
                // if the values for a shared attribute differ, add them to be displayed 

                if (values.length !== referenceValues.length) {
                    return true;
                }

                for (let i = 0; i < values.length; i++) {
                    const val = values[i];
                    const refVal = referenceValues[i];
                    if (att.attribute.type === AttributeDataType.INSTANCE) {
                        if (val?.dbId && refVal?.dbId && val.dbId !== refVal.dbId) {
                            return true; // once one value is different, add the whole attribute
                        }
                    } else {
                        if (val !== refVal) {
                            return true;
                        }

                    }
                }
                return false;
            });
            return of(attributeValues);
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
        return of(attributeValues);
    }

    override disconnect(): void {
    }

}