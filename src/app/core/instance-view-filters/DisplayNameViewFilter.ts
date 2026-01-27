import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { Store } from "@ngrx/store";
import { take, map, Observable } from "rxjs";
import { updatedInstances } from "src/app/instance/state/instance.selectors";
import { InstanceViewFilter } from "./InstanceViewFilter";
import { InstanceNameGenerator } from "../post-edit/InstanceNameGenerator";

export class DisplayNameViewFilter implements InstanceViewFilter {
    readonly dialog = inject(MatDialog);
    private nameGenerator: InstanceNameGenerator;

    constructor(private dataService: DataService,
        private utils: InstanceUtilities,
        private store: Store) {
            this.nameGenerator = new InstanceNameGenerator(this.dataService, this.utils);
    }

    filter(instance: Instance): Observable<Instance> {
        return this.store.select(updatedInstances()).pipe(
            take(1),
            map(updatedInsts => {
                if (this.validateReferenceDisplayName(instance, updatedInsts, this.nameGenerator, false)) {
                    let shemaClass = instance.schemaClass;
                    let source = instance.source ?? instance;
                    let modifiedAttributes = instance.modifiedAttributes ? [...instance.modifiedAttributes] : [];
                    // create a copy of the instance to avoid mutating the original one
                    let instanceCopyJSON = this.utils.stringifyInstance(instance);
                    let instanceCopy = JSON.parse(instanceCopyJSON);
                    instanceCopy.schemaClass = shemaClass;
                    instanceCopy.source = source;
                    instanceCopy.modifiedAttributes = modifiedAttributes;
                    this.utils.handleInstanceAttributes(instanceCopy);
                    this.validateReferenceDisplayName(instanceCopy, updatedInsts, this.nameGenerator, true);
                    return instanceCopy;
                }
                return instance;
            })
        )
    }

    validateReferenceDisplayName(inst: Instance, 
                                 updatedInsts: Instance[], 
                                 nameGenerator: InstanceNameGenerator,
                                 apply: boolean = true): boolean {
        if (!inst.attributes)
            return false; // No attributes, nothing to validate
        // For the time being, this is just one layer check. In the future, we may need to
        // make it recursive to check references of references for any local changes. But that may be slow.
        const dbId2updatedName = new Map(updatedInsts.map(inst => [inst.dbId, inst.displayName]));
        let instanceAttributeNameChanged = false;
        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue)
                continue;
            if (Array.isArray(attValue)) {
                for (let i = 0; i < attValue.length; i++) {
                    const attValue1 = attValue[i];
                    if (!this.utils.isInstance(attValue1))
                        break; // This is not a instance type attribute
                    let currentName = dbId2updatedName.get(attValue1.dbId);
                    if (currentName !== undefined && currentName !== attValue1.displayName) {
                        if (!apply) return true; // Just return true if there is no need to apply the change
                        instanceAttributeNameChanged = true;
                        attValue1.displayName = currentName;
                    }
                }
            }
            else if (this.utils.isInstance(attValue)) {
                let currentName = dbId2updatedName.get(attValue.dbId);
                if (currentName !== undefined && currentName !== attValue.displayName) {
                    if (!apply) return true;
                    instanceAttributeNameChanged = true;
                    attValue.displayName = currentName;
                }
            }
        }
        // Check should this instance's display name be changed too
        // This check should be done independently from attribute display name change
        // since an attribuate name change may be commiited already.
        let currentName = inst.displayName;
        // The supposed new display name due to attribute change
        let newDisplayName = nameGenerator.generateDisplayName(inst);
        if (newDisplayName !== 'unknown' && currentName !== newDisplayName) {   
            if (!apply) return true;
            inst.displayName = newDisplayName;
            if (inst.attributes)
                inst.attributes.set('displayName', newDisplayName);
            this.utils.registerDisplayNameChange(inst);
            instanceAttributeNameChanged = true;    
        }
        return instanceAttributeNameChanged;
    }
}