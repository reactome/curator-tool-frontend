import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AttributeValue, Instance } from "../models/reactome-instance.model";
import { InstanceUtilities } from "./instance.service";
import { DataService } from "./data.service";
import { STOICHIOMETRY_RELATIONSHIP_TYPES } from "../models/reactome-schema.model";

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
        private dataService: DataService,
        private snackBar: MatSnackBar
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

    public addValueToAttribute(attributeValue: AttributeValue, result: any, instance: Instance, replace?: boolean, showDuplicateNotification: boolean = true) {
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
                const ignoreIndex = replace ? attributeValue.index : undefined;
                if (this.containsValue(attributeValue.attribute.name, value, result, ignoreIndex)) {
                    if (showDuplicateNotification)
                        this.showDuplicateValueNotification(result);
                    return;
                }
                const deleteCount = replace ? 1 : 0;
                value.splice(attributeValue.index, deleteCount, result);
            }
        }
    }

    public addInstanceViaSelect(attributeValue: AttributeValue, result: any, instance: Instance, replace: boolean = false, showDuplicateNotification: boolean = true) {
        // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
        // Add the new value
        if (result === undefined || !result || result.length === 0 || result[0].dbId === undefined) return; // Do nothing if this is undefined or resolve to false (e.g. nothing there)
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
                const ignoreIndex = replace ? attributeValue.index : undefined;
                const duplicateValues = result.filter((candidate: any) => this.containsValue(attributeValue.attribute.name, value, candidate, ignoreIndex));
                const uniqueValues = result.filter((candidate: any) => !this.containsValue(attributeValue.attribute.name, value, candidate, ignoreIndex));

                if (showDuplicateNotification && duplicateValues.length > 0) {
                    this.showDuplicateValueNotification(duplicateValues.length === 1 ? duplicateValues[0] : duplicateValues);
                }

                if (uniqueValues.length === 0) {
                    return;
                }

                const deleteCount = replace ? 1 : 0;
                value.splice(attributeValue.index, deleteCount, ...uniqueValues);
            }
        }
    }

    private containsValue(attributeName: string, values: any[], candidate: any, ignoreIndex?: number): boolean {
        if (this.allowsDuplicateInstanceValue(attributeName, candidate)) {
            return false;
        }

        return values.some((value, index) => {
            if (ignoreIndex !== undefined && index === ignoreIndex) {
                return false;
            }
            return this.isSameValue(value, candidate);
        });
    }

    private allowsDuplicateInstanceValue(attributeName: string, candidate: any): boolean {
        return STOICHIOMETRY_RELATIONSHIP_TYPES.includes(attributeName) && this.instUtil.isInstance(candidate);
    }

    private isSameValue(left: any, right: any): boolean {
        if (left === right) {
            return true;
        }

        if (left && right && typeof left === 'object' && typeof right === 'object' && 'dbId' in left && 'dbId' in right) {
            return left.dbId === right.dbId;
        }

        return JSON.stringify(left) === JSON.stringify(right);
    }

    private showDuplicateValueNotification(value: any) {
        const formattedValue = this.formatDuplicateValue(value);
        const message = formattedValue
            ? `This value already exists and was not added: ${formattedValue}`
            : 'This value already exists and was not added.';
        this.snackBar.open(message, 'OK', {
            duration: 5000
        });
    }

    private formatDuplicateValue(value: any): string {
        if (Array.isArray(value)) {
            return value.map(item => this.formatDuplicateValue(item)).join(', ');
        }

        if (value && typeof value === 'object') {
            if ('displayName' in value && value.displayName) {
                return String(value.displayName);
            }
            if ('dbId' in value) {
                return String(value.dbId);
            }
        }

        return String(value ?? '');
    }

    public onNoInstanceAttributeEdit(attributeValue: AttributeValue, result: any, instance: Instance, replace?: boolean, showDuplicateNotification: boolean = true) {
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
                    const ignoreIndex = attributeValue.index! >= 0 ? attributeValue.index : undefined;
                    if (this.containsValue(attributeValue.attribute.name, valueList, result, ignoreIndex)) {
                        if (showDuplicateNotification)
                            this.showDuplicateValueNotification(result);
                        return;
                    }
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

    removeModifiedAttribute(instance: Instance | undefined, attributeName: string) {
        if (!instance ||
            !instance.modifiedAttributes ||
            instance.modifiedAttributes.length === 0
        ) return; // Do nothing if there is no modified attributes
        let index = instance.modifiedAttributes.indexOf(attributeName);
        if (index > -1)
            instance.modifiedAttributes!.splice(index, 1);

    }

    removeDisplayNameModifiedAttribute(instance: Instance | undefined) {
        this.removeModifiedAttribute(instance, 'displayName');
    }

    resetAttributeValue(instance: Instance | undefined, attributeValue: AttributeValue) {
        if (!instance || !instance.attributes) return; // Do nothing if instance is undefined
        let refValue = attributeValue.referenceValue;
        if (refValue) {
            if (attributeValue.attribute.cardinality === '1') {
                instance.attributes.set(
                    attributeValue.attribute.name,
                    refValue
                );
            } else {
                instance.attributes.set(
                    attributeValue.attribute.name,
                    [...refValue]
                );
            }
        }
        else {
            // Use delete for the map!
            instance.attributes.delete(attributeValue.attribute.name);
        }
    }

}