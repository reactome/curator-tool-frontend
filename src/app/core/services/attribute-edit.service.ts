import { Injectable } from "@angular/core";
import { AttributeValue, Instance } from "../models/reactome-instance.model";
import { InstanceUtilities } from "./instance.service";
import { DataService } from "./data.service";

@Injectable({
    providedIn: 'root'
})
/**
 * This service is to handle attribute editing for instances. 
 * There are two types of editing regarding the editing source: 1). Active editing via instance attribute edit component; 
 * 2). Passive editing by changing in in the referenced instance, e.g. deletion of the reference instance, changes in 
 * reference instance resulting in changes in the attribute value (display name usually). Active edting includes post edting
 * such as _displayName update, reviewStatus update, etc.
 */
export class AttributeEditService {

    public constructor(private instUtil: InstanceUtilities,
        private dataService: DataService
        // Initialize any other properties if needed
    ) {
    }

    public deleteInstanceAttribute(attributeValue: AttributeValue, instance: Instance): void {
        console.debug('deleteInstanceAttribute: ', attributeValue);
        let value = instance?.attributes?.get(attributeValue.attribute.name);
        if (attributeValue.attribute.cardinality === '1') {
            // This should not occur. Just in case
            //this._instance?.attributes?.delete(attributeValue.attribute?.name);
            instance?.attributes?.set(
                attributeValue.attribute?.name,
                undefined
            );
        } else {
            // This should be a list
            const valueList: [] = instance?.attributes?.get(
                attributeValue.attribute.name
            );
            // Remove the value if more than one
            if (valueList.length > 1) {
                valueList.splice(attributeValue.index!, 1);
            }
            // Otherwise need to set the value to undefined so a value is assigned
            else {
                instance?.attributes?.set(
                    attributeValue.attribute?.name,
                    undefined
                );
            }
        }
        //this.finishEdit(attributeValue.attribute.name, value, instance);
    }

    public addValueToAttributeInBatch(attributeValue: AttributeValue, result: any, data: Instance[], replace?: boolean) {
        let objects = this.dataService.fetchInstanceInBatch(data.map(inst => inst.dbId));
        // for (let instance of objects) {
        //     this.addValueToAttribute(attributeValue, result, instance, replace);
        // }
    }

    public addValueToAttribute(attributeValue: AttributeValue, result: any, instance: Instance, replace?: boolean,) {
        if (result === undefined || result === null) { return; } // Do nothing if this is undefined or resolve to false (e.g. nothing there)
        let value = instance?.attributes?.get(attributeValue.attribute.name);
        if (value === undefined) {
            // It should be the first
            if (attributeValue.attribute.cardinality === '1') {
                instance?.attributes?.set(attributeValue.attribute.name, result);
            } else {
                instance?.attributes?.set(attributeValue.attribute.name, [
                    result,
                ]);
            }
        } else {
            // It should be the first
            if (attributeValue.attribute.cardinality === '1') {
                // Make sure only one value used
                instance?.attributes?.set(attributeValue.attribute.name, result);
            }
            else {
                const deleteCount = replace ? 1 : 0;
                value.splice(attributeValue.index, deleteCount, result);
            }
        }
    }

    public addInstanceViaSelect(attributeValue: AttributeValue, result: any, instance: Instance, replace: boolean = false) {
        // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
        // Add the new value
        if (result === undefined || !result || result[0].dbId === undefined) return; // Do nothing if this is undefined or resolve to false (e.g. nothing there)
        // Check if there is any value
        //this.addValueToAttribute(attributeValue, result);
        result = result.map((inst: Instance) => this.instUtil.getShellInstance(inst));
        let value = instance?.attributes?.get(
            attributeValue.attribute.name
        );
        if (value === undefined) {
            // It should be the first
            if (attributeValue.attribute.cardinality === '1') {
                instance?.attributes?.set(
                    attributeValue.attribute.name,
                    result[0]
                );
            } else {
                instance?.attributes?.set(
                    attributeValue.attribute.name,
                    result
                );
            }
        } else {
            // It should be the first
            if (attributeValue.attribute.cardinality === '1') {
                // Make sure only one value used
                instance?.attributes?.set(
                    attributeValue.attribute.name,
                    result.length > 0 ? result[0] : undefined
                );
            } else {
                const deleteCount = replace ? 1 : 0;
                value.splice(attributeValue.index, deleteCount, ...result);
            }
        }
    }

    public onNoInstanceAttributeEdit(attributeValue: AttributeValue, result: any, instance: Instance, replace?: boolean) {
        let value = instance?.attributes?.get(attributeValue.attribute.name);
        if (attributeValue.attribute.cardinality === '1') {
            instance?.attributes?.set(attributeValue.attribute.name, result);
        } else {
            // This should be a list
            if (result === '') {
                value.splice(attributeValue.index, 1);
            } else {
                let valueList = instance?.attributes!.get(attributeValue.attribute.name);
                if (valueList === undefined) {
                    instance?.attributes?.set(attributeValue.attribute.name, [result]);
                } else {
                    if (attributeValue.index! < 0) {
                        value.push(result);
                    } else {
                        value[attributeValue.index!] = result;
                    }
                }
            }
        }
        if (attributeValue.value === value) {
            // If the value is the same as the current value, do not update
            // This is to avoid unnecessary updates
            return;
        }
    }

    /**
     * Delete an non-instance attribute value
     * @param attributeValue
     * @returns 
     */
    deleteAttributeValue(instance: Instance | undefined, attributeValue: AttributeValue) {
        if (!instance) return; // Do nothing if instance is undefined
        console.log('deleteAttributeValue: ', attributeValue);
        let value = instance?.attributes?.get(attributeValue.attribute.name);
        //this.addModifiedAttribute(attributeValue.attribute.name, value);
        if (attributeValue.attribute.cardinality === '1') {
            // This should not occur. Just in case
            //this._instance?.attributes?.delete(attributeValue.attribute?.name);
            instance?.attributes?.set(
                attributeValue.attribute?.name,
                undefined
            );
        } else {
            // This should be a list
            const valueList: [] = instance?.attributes?.get(
                attributeValue.attribute.name
            );
            // Remove the value if more than one
            if (valueList.length > 1) {
                valueList.splice(attributeValue.index!, 1);
            }
            // Otherwise need to set the value to undefined so a value is assigned
            else {
                instance?.attributes?.set(
                    attributeValue.attribute?.name,
                    undefined
                );
            }
        }
        if (attributeValue.value === value) {
            // If the value is the same as the current value, do not update
            // This is to avoid unnecessary updates
            return;
        }
    }

    addModifiedAttribute(instance: Instance | undefined, attributeName: string) {
        this.instUtil.addToModifiedAttributes(attributeName, instance);
    }

}