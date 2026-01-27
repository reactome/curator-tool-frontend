import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { Store } from "@ngrx/store";
import { take, map, Observable } from "rxjs";
import { deleteInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { InstanceViewFilter } from "./InstanceViewFilter";

export class DeletedInstanceAttributeFilter implements InstanceViewFilter {
    readonly dialog = inject(MatDialog);

    constructor(private utils: InstanceUtilities,
        private store: Store) {
    }

    filter(instance: Instance): Observable<Instance> {
        return this.store.select(deleteInstances()).pipe(
            take(1),
            map(deletedInsts => {
                // check if local deletions should be applied before deleting, otherwise source is changed 
                if (this.utils.applyLocalDeletions(instance, deletedInsts, false)) {
                    // create a copy of the instance to avoid mutating the original one
                    let shemaClass = instance.schemaClass;
                    let source = instance.source ?? instance;
                    let modifiedAttributes = instance.modifiedAttributes ? [...instance.modifiedAttributes] : [];
                    let instanceCopyJSON = this.utils.stringifyInstance(instance);
                    let instanceCopy = JSON.parse(instanceCopyJSON);
                    instanceCopy.schemaClass = shemaClass;
                    instanceCopy.source = source;
                    instanceCopy.modifiedAttributes = modifiedAttributes;
                    this.utils.handleInstanceAttributes(instanceCopy);
                    this.utils.applyLocalDeletions(instanceCopy, deletedInsts);
                    return instanceCopy;
                }
                else
                    return instance;
            })
        );
    }
}