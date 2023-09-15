/**
 * This script holds classes defined for the instance table.
 */

import { DataSource } from "@angular/cdk/collections";
import { Observable, of } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { SchemaAttribute } from "src/app/core/models/reactome-schema.model";

/**
 * Used to encode the data for the attribute value cell. 
 */
export interface AttributeValue {
    attribute: SchemaAttribute,
    value: any
}

/**
 * Customize a DataSource so that we can use an Instance object directly for table display.
 */
export class InstanceDataSource extends DataSource<AttributeValue> {

    constructor(private instance: Instance | undefined) {
        super();
    }

    override connect(): Observable<AttributeValue[]> {
        const attributeValues: AttributeValue[] = [];
        if (this.instance) {
            for (let attribute of this.instance.schemaClass?.attributes!) {
                let value = this.instance.attributes?.get(attribute.name);
                const attributeValue = {
                    attribute: attribute,
                    value: value
                };
                attributeValues.push(attributeValue);
            }
        }
        return of(attributeValues);
    }

    override disconnect(): void {
    }

}
