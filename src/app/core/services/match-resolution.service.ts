import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { concatMap, from, map, Observable, of, toArray } from "rxjs";
import { Instance, MatchResolution } from "../models/reactome-instance.model";
import { AttributeCategory, SchemaAttribute, STOICHIOMETRY_RELATIONSHIP_TYPES } from "../models/reactome-schema.model";
import { UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { DataService } from "./data.service";
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
                this.mergeAttributes(newInstance, existing);
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

    /**
     * Apply the new instance's attribute values onto the existing instance:
     * single-valued attributes are overwritten with the new value; multivalued attributes get
     * the new values appended to the end (skipping exact duplicates).
     */
    private mergeAttributes(newInstance: Instance, existing: Instance): void {
        const newAttributes: Map<string, any> = newInstance.attributes;
        if (!newAttributes) return;
        if (!(existing.attributes instanceof Map)) {
            this.dataService.handleInstanceAttributes(existing);
        }
        const existingAttributes: Map<string, any> = existing.attributes;

        const attributes = this.getEditableAttributes(newInstance);
        const notClonable = this.dataService.getAttributeNamesNotClonable();

        for (const attribute of attributes) {
            if (attribute.category === AttributeCategory.NOMANUALEDIT) continue;
            if (attribute.name === 'dbId' || attribute.name === 'displayName') continue;
            if (notClonable.includes(attribute.name)) continue;

            const newValue = newAttributes.get(attribute.name);
            if (newValue === undefined || newValue === null) continue;

            if (attribute.cardinality === '1') {
                existingAttributes.set(attribute.name, newValue);
                this.instUtils.addToModifiedAttributes(attribute.name, existing);
            } else {
                const newValues = Array.isArray(newValue) ? newValue : [newValue];
                if (newValues.length === 0) continue;
                const existingValues = existingAttributes.get(attribute.name);
                if (existingValues === undefined || existingValues === null) {
                    existingAttributes.set(attribute.name, [...newValues]);
                    this.instUtils.addToModifiedAttributes(attribute.name, existing);
                } else {
                    // Stoichiometry relationship attributes intentionally allow duplicate
                    // instance values (e.g. two molecules of the same input), matching
                    // AttributeEditService; other attributes skip exact duplicates.
                    const allowDuplicates = STOICHIOMETRY_RELATIONSHIP_TYPES.includes(attribute.name);
                    let added = false;
                    for (const value of newValues) {
                        if (allowDuplicates || !existingValues.some((v: any) => this.isSameValue(v, value))) {
                            existingValues.push(value);
                            added = true;
                        }
                    }
                    if (added)
                        this.instUtils.addToModifiedAttributes(attribute.name, existing);
                }
            }
        }
    }

    private getEditableAttributes(instance: Instance): SchemaAttribute[] {
        const schemaClass = instance.schemaClass ?? this.dataService.getSchemaClass(instance.schemaClassName);
        return schemaClass?.attributes ?? [];
    }

    /** Mirrors AttributeEditService.isSameValue: instances compare by dbId, others by value. */
    private isSameValue(left: any, right: any): boolean {
        if (left === right) {
            return true;
        }
        if (left && right && typeof left === 'object' && typeof right === 'object' && 'dbId' in left && 'dbId' in right) {
            return left.dbId === right.dbId;
        }
        return JSON.stringify(left) === JSON.stringify(right);
    }
}
