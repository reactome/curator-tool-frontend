/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { Observable, of } from "rxjs";
import { AttributeValue, Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from "src/app/core/models/reactome-schema.model";
import { DatabaseMergeRow } from "src/app/core/services/database-merge.service";


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
    BOOKMARK,
    EDIT_STOICHIOMETRY,
    SHOW_REFERRERS
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
        let instanceAttributes = this.instance?.schemaClass?.attributes || [];
        let referenceAttributes = this.referenceInstance?.schemaClass?.attributes || [];
        for (const attr of referenceAttributes) {
            allAttributes.set(attr.name, attr);
        }
        for (const attr of instanceAttributes) {
            allAttributes.set(attr.name, attr);
        }

        // instance.schemaClass.attributes should be the union of the two instance's attributes
        let attributeValues: AttributeValue[] = [];
        allAttributes.forEach((attribute: SchemaAttribute) => {
            let value = this.instance?.attributes?.get(attribute.name);
            let refValue = this.referenceInstance?.attributes?.get(attribute.name);

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
                        // Compare dbIds even when one side is missing: a value present on one
                        // instance and absent on the other is a difference, and so is an unsaved
                        // (dbId-less) instance sitting opposite a database one. Unsaved instances
                        // have no dbId to compare, so fall back to identity for those.
                        if ((val?.dbId ?? val) !== (refVal?.dbId ?? refVal)) {
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
/**
 * The rows of a merge with the database copy (see DatabaseMergeService), shown in the comparison
 * table. Only the attributes that differ are listed, so the "edited" filter does not apply.
 *
 * The values come from the merge rows rather than from the instance the table shows: the rows are
 * what will be merged, and the displayed instance has been through the view filters (deleted
 * references stripped, display name regenerated), so it is not quite the staged copy.
 */
export class InstanceMergeDataSource extends DataSource<AttributeValue> {

    constructor(private rows: DatabaseMergeRow[],
        private categories: Map<AttributeCategory, boolean>,
        public sort: boolean,
        public sortAttDefined: boolean) {
        super();
    }

    override connect(): Observable<AttributeValue[]> {
        const asValue = (row: DatabaseMergeRow, values: any[]) => {
            if (values.length === 0)
                return undefined;
            return row.multiValued ? values : values[0];
        };
        const attributeValues: AttributeValue[] = this.rows
            .filter(row => this.categories.get(row.attribute.category))
            .map(row => ({
                attribute: row.attribute,
                value: asValue(row, row.localValues),
                referenceValue: asValue(row, row.databaseValues),
            }));
        if (this.sort)
            attributeValues.sort((a, b) => a.attribute.name.localeCompare(b.attribute.name));
        else
            attributeValues.sort((a, b) => b.attribute.name.localeCompare(a.attribute.name));
        if (this.sortAttDefined)
            attributeValues.sort((a, b) => a.attribute.definingType < b.attribute.definingType ? -1 : 1);
        return of(attributeValues);
    }

    override disconnect(): void {
    }
}
