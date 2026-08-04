import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { concatMap, from, map, Observable, of, toArray } from "rxjs";
import { Instance, MatchResolution } from "../models/reactome-instance.model";
import { UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { DataService } from "./data.service";
import { InstanceMergeService } from "./instance-merge.service";
import { InstanceUtilities } from "./instance.service";

/**
 * Applies the user's decisions from the matched-instances (duplicate) dialog.
 *
 * For each new instance that matched an existing database instance the user may choose to:
 * - commit it anyway (handled by the caller, which commits the returned instances);
 * - use an existing instance instead (repoint references, discard the new instance); or
 * - merge the new instance into an existing one (copy attributes, stage the existing
 *   instance as an update, repoint references, discard the new instance).
 *
 * See {@link MatchResolution} and the matched-instances dialog.
 */
@Injectable({
    providedIn: 'root'
})
export class MatchResolutionService {

    constructor(private dataService: DataService,
        private instUtils: InstanceUtilities,
        private mergeService: InstanceMergeService,
        private store: Store) {
    }

    /**
     * Apply the resolutions and return the real, cache-registered new instances the user chose
     * to commit anyway. The caller commits those exactly as before. 'use-existing' and 'merge'
     * resolutions are applied here (as side effects) and excluded from the returned list.
     */
    resolve(resolutions: MatchResolution[] | undefined): Observable<Instance[]> {
        if (!resolutions || resolutions.length === 0) {
            return of([]);
        }

        const commitAnyway: Instance[] = [];
        return from(resolutions).pipe(
            // Sequential to avoid racing the shared id2instance cache and NgRx store.
            concatMap(resolution => {
                const newInstance = this.dataService.getCachedInstance(resolution.newInstanceDbId);
                if (!newInstance) {
                    return of(null);
                }
                if (resolution.action === 'commit-anyway') {
                    commitAnyway.push(newInstance);
                    return of(null);
                }
                if (resolution.existingInstanceDbId === undefined) {
                    return of(null);
                }
                if (resolution.action === 'use-existing') {
                    return this.useExisting(newInstance, resolution.existingInstanceDbId);
                }
                if (resolution.action === 'merge') {
                    return this.merge(newInstance, resolution.existingInstanceDbId);
                }
                return of(null);
            }),
            toArray(),
            map(() => commitAnyway)
        );
    }

    /**
     * Discard the new instance and repoint every reference to it at the chosen existing instance.
     */
    private useExisting(newInstance: Instance, existingDbId: number): Observable<null> {
        return this.dataService.fetchInstance(existingDbId).pipe(
            map(existing => {
                this.dataService.replaceInstanceReferences(newInstance.dbId, existing);
                this.dataService.discardNewInstance(newInstance);
                return null;
            })
        );
    }

    /**
     * Copy the new instance's attributes onto the chosen existing instance, stage the existing
     * instance as an update, then repoint references and discard the new instance.
     */
    private merge(newInstance: Instance, existingDbId: number): Observable<null> {
        return this.dataService.fetchInstance(existingDbId).pipe(
            map(existing => {
                this.mergeService.applyMergeAttributes(newInstance, existing);
                // Ensure the merged full instance is in the cache (commit pulls from id2instance)
                // and stage it as an updated instance so the merge is committed later.
                this.dataService.registerInstance(existing);
                this.store.dispatch(UpdateInstanceActions.register_updated_instance(this.instUtils.makeShell(existing)));

                this.dataService.replaceInstanceReferences(newInstance.dbId, existing);
                this.dataService.discardNewInstance(newInstance);
                return null;
            })
        );
    }

}
