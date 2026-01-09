import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { Store } from "@ngrx/store";
import { take, map, Observable, of } from "rxjs";
import { deleteInstances } from "src/app/instance/state/instance.selectors";
import { ReviewStatusCheck } from "../post-edit/ReviewStatusCheck";
import { InstanceViewFilter } from "./InstanceViewFilter";


export class ReviewStatusUpdateFilter implements InstanceViewFilter {
    readonly dialog = inject(MatDialog);

    constructor(private dataService: DataService,
        private utils: InstanceUtilities,
        private store: Store,
        private reviewStatusCheck: ReviewStatusCheck) {
    }

    filter(instance: Instance): Observable<Instance> {
        // Only check review status for event instances 
        // if (!this.dataService.isEventClass(instance.schemaClass?.name!)) {
        //     return of(instance);
        // }

        return this.store.select(deleteInstances()).pipe(
            take(1),
            map((instances) => {
                let deletedDbIds = instances.map(inst => inst.dbId);
                let sourceInstance = instance.source ?? instance;
                if (sourceInstance.attributes) {
                    let dbIdInstanceAtts = sourceInstance.attributes;
                    let structuralAttributes = ['hasEvent', 'input', 'output', 'catalystActivity', 'regulatedBy'];
                    for (let attName of dbIdInstanceAtts.keys()) {
                        if (structuralAttributes.includes(attName)) {
                            let attValue = dbIdInstanceAtts.get(attName);
                            if (attValue) {
                                if (attValue instanceof Array) {
                                    for (let val of attValue) {
                                        if (deletedDbIds.includes(val.dbId)) {
                                            if (this.reviewStatusCheck.handleReviewStatus(instance, attName)) {
                                                let instanceCopyJSON = this.utils.stringifyInstance(instance);
                                                let instanceCopy = JSON.parse(instanceCopyJSON); instanceCopy.source = instance.source ?? instance;
                                                this.utils.handleInstanceAttributes(instanceCopy);
                                                return instanceCopy;
                                            }
                                        }
                                    }
                                }
                                else {
                                    if (deletedDbIds.includes(attValue.dbId)) {
                                        if (this.reviewStatusCheck.handleReviewStatus(instance, attValue.attribute.name)) {
                                            let instanceCopyJSON = this.utils.stringifyInstance(instance);
                                            let instanceCopy = JSON.parse(instanceCopyJSON); instanceCopy.source = instance.source ?? instance;
                                            this.utils.handleInstanceAttributes(instanceCopy);
                                            return instanceCopy;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return instance;
            })

        );
    }
}