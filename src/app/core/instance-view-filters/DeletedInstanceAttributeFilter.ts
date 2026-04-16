import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { Store } from "@ngrx/store";
import { combineLatest, take, map, Observable } from "rxjs";
import { deleteInstances, newInstances } from "src/app/instance/state/instance.selectors";
import { InstanceViewFilter } from "./InstanceViewFilter";

export class DeletedInstanceAttributeFilter implements InstanceViewFilter {
    readonly dialog = inject(MatDialog);

    constructor(private utils: InstanceUtilities,
        private store: Store) {
    }

    filter(instance: Instance): Observable<Instance> {
        return combineLatest([
            this.store.select(deleteInstances()).pipe(take(1)),
            this.store.select(newInstances()).pipe(take(1)),
        ]).pipe(
            map(([deletedInsts, newInsts]) => {
                const activeNewIds = new Set((newInsts || []).map(i => i.dbId));
                // Treat any negative-dbId attribute value no longer in staged new instances as deleted
                const removedNewInsts = this.getRemovedNewInstanceRefs(instance, activeNewIds);
                if (removedNewInsts.length > 0) {
                    // Removing local-only (negative dbId) instances should be a real modification,
                    // not a passive display-only edit.
                    this.utils.applyLocalDeletions(instance, removedNewInsts, true, false);
                    if (instance.source && instance.source !== instance)
                        this.utils.applyLocalDeletions(instance.source, removedNewInsts, true, false);
                }

                const allDeletedInsts = [...deletedInsts, ...removedNewInsts];
                // check if local deletions should be applied before deleting, otherwise source is changed 
                if (this.utils.applyLocalDeletions(instance, allDeletedInsts, false)) {
                    // create a copy of the instance to avoid mutating the original one
                    let schemaClass = instance.schemaClass;
                    let source = instance.source ?? instance;
                    let modifiedAttributes = instance.modifiedAttributes ? [...instance.modifiedAttributes] : [];
                    let instanceCopyJSON = this.utils.stringifyInstance(instance);
                    let instanceCopy = JSON.parse(instanceCopyJSON);
                    instanceCopy.schemaClass = schemaClass;
                    instanceCopy.source = source;
                    instanceCopy.modifiedAttributes = modifiedAttributes;
                    this.utils.handleInstanceAttributes(instanceCopy);
                    this.utils.applyLocalDeletions(instanceCopy, allDeletedInsts);
                    return instanceCopy;
                }
                else
                    return instance;
            })
        );
    }

    /** Returns minimal Instance stubs for any negative-dbId attribute references not in activeNewIds. */
    private getRemovedNewInstanceRefs(instance: Instance, activeNewIds: Set<number>): Instance[] {
        let seen = new Set<number>();
        if (!instance.attributes) return [];
        for (let att of instance.attributes.keys()) {
            let attValue = instance.attributes.get(att);
            if (!attValue) continue;
            let vals: any[] = Array.isArray(attValue) ? attValue : [attValue];
            for (let v of vals) {
                if (v?.dbId !== undefined && v.dbId < 0 && !activeNewIds.has(v.dbId))
                    seen.add(v.dbId);
            }
        }
        return Array.from(seen).map(dbId => ({ dbId } as Instance));
    }
}