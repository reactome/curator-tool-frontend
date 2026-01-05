import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { Store } from "@ngrx/store";
import { take, map, Observable } from "rxjs";
import { updatedInstances } from "src/app/instance/state/instance.selectors";
import { InstanceViewFilter } from "./InstanceViewFilter";

export class DisplayNameViewFilter implements InstanceViewFilter {
    readonly dialog = inject(MatDialog);

    constructor(private dataService: DataService,
        private utils: InstanceUtilities,
        private store: Store) {
    }

    filter(instance: Instance): Observable<Instance> {
        return this.store.select(updatedInstances()).pipe(
            take(1),
            map(updatedInsts => {
                if (this.utils.validateReferenceDisplayName(instance, updatedInsts)) {
                    // create a copy of the instance to avoid mutating the original one
                    let instanceCopy = this.utils.cloneInstance(instance);
                    instanceCopy.source = instance.source ?? instance;
                    return instanceCopy;

                }
                return instance;
            })
        )
    }
}