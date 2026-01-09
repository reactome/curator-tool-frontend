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
                if (this.utils.validateReferenceDisplayName(instance, updatedInsts, false)) {
                    let shemaClass = instance.schemaClass;
                    let source = instance.source ?? instance;
                    // create a copy of the instance to avoid mutating the original one
                    let instanceCopyJSON = this.utils.stringifyInstance(instance);
                    let instanceCopy = JSON.parse(instanceCopyJSON);
                    instanceCopy.schemaClass = shemaClass;
                    instanceCopy.source = source;
                    this.utils.handleInstanceAttributes(instanceCopy);
                    this.utils.validateReferenceDisplayName(instanceCopy, updatedInsts);
                    return instanceCopy;

                }
                return instance;
            })
        )
    }
}