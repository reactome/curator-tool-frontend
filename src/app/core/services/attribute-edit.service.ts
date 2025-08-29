import { Injectable } from "@angular/core";
import { AttributeValue } from "src/app/instance/components/instance-view/instance-table/instance-table.model";
import { Instance } from "../models/reactome-instance.model";
import { InstanceUtilities } from "./instance.service";
import { Store } from "@ngrx/store";
import { UpdateInstanceActions, NewInstanceActions } from "src/app/instance/state/instance.actions";
import { PostEditService } from "./post-edit.service";
import { PostEditListener } from "../post-edit/PostEditOperation";
import { DataService } from "./data.service";

@Injectable({
    providedIn: 'root'
})
/**
 * This class is used to fetch instance and class definition from the RESTful API.
 */
export class AttributeEditService implements PostEditListener {
    private preventEvent: boolean = false; // Set to false by default

    public constructor(private instUtil: InstanceUtilities,
        private store: Store,
        private dataService: DataService,
        private postEditService: PostEditService, // This is used to perform post-edit actions) {
        // Initialize any other properties if needed
    ) {
    }
    donePostEdit(instance: Instance, editedAttributeName: string | undefined): boolean {
        throw new Error("Method not implemented.");
    }

    // public fetchInstancesInBatch(data: Instance[]): Instance[] {
    //     let databaseObjects: Instance[] = [];
    //     this.dataService.fetchInstanceInBatch(data.map(inst => inst.dbId)).subscribe(
    //         (instances: any) => {
    //             databaseObjects = instances;
    //         }
    //     );
    //     return databaseObjects;
    // }

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
        //this.finishEdit(attributeValue.attribute.name, value, instance);
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

}