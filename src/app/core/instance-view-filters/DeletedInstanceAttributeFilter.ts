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
                if (this.utils.applyLocalDeletions(instance, deletedInsts)) {
                    // create a copy of the instance to avoid mutating the original one
                    let instanceCopy = this.utils.cloneInstance(instance);
                    instanceCopy.source = instance.source ?? instance;
                    return instanceCopy;
                }
                else
                    return instance;
            })
        );
    }
}