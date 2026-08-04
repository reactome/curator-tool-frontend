import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { concatMap, forkJoin, map, Observable, of, take } from "rxjs";
import { Instance, MAX_STAGED_INSTANCES } from "../models/reactome-instance.model";
import { AttributeCategory, SchemaAttribute, SchemaClass } from "../models/reactome-schema.model";
import { DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { DataService } from "./data.service";
import { InstanceUtilities } from "./instance.service";
import { InstanceNameGenerator } from "../post-edit/InstanceNameGenerator";

/**
 * The class the merged instance will be created in, plus why it was chosen.
 * See {@link InstanceMergeService.resolveTargetSchemaClass}.
 */
export interface MergeTargetClass {
  /** The class to create the merged instance in. Always concrete, always has its attributes loaded. */
  schemaClass: SchemaClass;
  /** Name of the nearest common ancestor of the two instances, even when it is abstract. */
  commonAncestorName?: string;
  /**
   * Set when the nearest common ancestor is abstract and therefore cannot be instantiated. The
   * message explains which class was used instead so the dialog can show it to the curator.
   */
  fallbackNote?: string;
}

/** One attribute's final value list for a merged (third) instance. */
export interface MergeAttributeSelection {
  attributeName: string;
  /** The chosen values, in the order they should appear. Empty means "leave the slot empty". */
  values: any[];
}

/**
 * How many referrers a merge-into is willing to repoint. Each referrer becomes a staged update,
 * so the ceiling is the staging limit itself.
 */
export const MAX_MERGE_REFERRERS = MAX_STAGED_INSTANCES;

/** Outcome of {@link InstanceMergeService.mergeInto}. */
export interface MergeIntoResult {
  target: Instance;
  /** Referrer instances whose reference was moved from the source to the target. */
  changedReferrers: Instance[];
}

/**
 * Merging of two instances. Two shapes are supported:
 *
 * 1. "Create a new merged instance": a brand new instance is created in the two instances'
 *    common class and the curator picks, attribute by attribute, which values to carry over.
 *    Both originals are left untouched. See {@link createMergedInstance}.
 *
 * 2. "Merge one instance into another": the source's single-valued attributes overwrite the
 *    target's, its multivalued attributes are appended to the end of the target's lists, every
 *    reference to the source is repointed at the target, and the source is staged for deletion.
 *    See {@link mergeInto}.
 *
 * The attribute-level copying of shape 2 is also what the duplicate-check dialog uses when a new
 * instance is merged into an existing database instance; MatchResolutionService delegates to
 * {@link applyMergeAttributes} so there is a single implementation of those semantics.
 */
@Injectable({
  providedIn: 'root'
})
export class InstanceMergeService {

  constructor(private dataService: DataService,
    private instUtils: InstanceUtilities,
    private store: Store) {
  }

  /**
   * The attributes of a class that a merge is allowed to touch: everything except the
   * server-managed slots, the identity slots, and the provenance slots that a clone does not
   * copy either (created/modified/reviewed/...).
   */
  getMergeableAttributes(schemaClass: SchemaClass | undefined): SchemaAttribute[] {
    const notClonable = this.dataService.getAttributeNamesNotClonable();
    return (schemaClass?.attributes ?? []).filter(attribute => this.isMergeable(attribute, notClonable));
  }

  private isMergeable(attribute: SchemaAttribute, notClonable: string[]): boolean {
    if (attribute.category === AttributeCategory.NOMANUALEDIT)
      return false;
    if (attribute.name === 'dbId' || attribute.name === 'DB_ID' || attribute.name === 'displayName')
      return false;
    return !notClonable.includes(attribute.name);
  }

  /**
   * Work out which class a merged instance should be created in.
   *
   * Two instances of the same class merge into that class. Otherwise the nearest common ancestor
   * is used, so that only attributes both instances can meaningfully hold are offered. The
   * ancestor is frequently abstract (Complex and DefinedSet meet at PhysicalEntity, for example)
   * and an abstract class cannot be instantiated; in that case the first instance's class is used
   * instead and a note is returned so the dialog can tell the curator what happened.
   */
  resolveTargetSchemaClass(first: Instance, second: Instance): Observable<MergeTargetClass> {
    const ancestorName = this.nearestCommonAncestorName(first.schemaClassName, second.schemaClassName);
    if (ancestorName && !this.dataService.getSchemaClass(ancestorName).abstract) {
      return this.dataService.fetchSchemaClass(ancestorName).pipe(
        map(schemaClass => ({ schemaClass, commonAncestorName: ancestorName }))
      );
    }
    // No usable common ancestor: fall back to the class of the instance the merge started from.
    return this.dataService.fetchSchemaClass(first.schemaClassName).pipe(
      map(schemaClass => ({
        schemaClass,
        commonAncestorName: ancestorName,
        fallbackNote: ancestorName
          ? `${first.schemaClassName} and ${second.schemaClassName} only meet at ${ancestorName}, which is abstract. `
          + `The merged instance will be a ${first.schemaClassName}; attributes that only ${second.schemaClassName} defines cannot be carried over.`
          : `${first.schemaClassName} and ${second.schemaClassName} share no common class. `
          + `The merged instance will be a ${first.schemaClassName}.`
      }))
    );
  }

  /**
   * The closest class that is an ancestor of (or equal to) both class names, walking up the
   * cached schema tree. Returns undefined if the two classes are unrelated.
   */
  nearestCommonAncestorName(firstName: string, secondName: string): string | undefined {
    if (firstName === secondName)
      return firstName;
    const firstAncestors = new Set<string>();
    let current: SchemaClass | undefined = this.dataService.getSchemaClass(firstName);
    while (current) {
      firstAncestors.add(current.name);
      current = current.parent;
    }
    current = this.dataService.getSchemaClass(secondName);
    while (current) {
      if (firstAncestors.has(current.name))
        return current.name;
      current = current.parent;
    }
    return undefined;
  }

  /**
   * Create a brand new instance in the passed class holding the picked values, register it as a
   * staged new instance and return it. Neither source instance is modified.
   */
  createMergedInstance(schemaClass: SchemaClass,
    selections: MergeAttributeSelection[]): Observable<Instance> {
    return this.dataService.createNewInstance(schemaClass.name).pipe(
      map(merged => {
        // createNewInstance() resolves the class by name; use the class we were handed so the
        // attribute list the dialog worked from is exactly the one applied here.
        merged.schemaClass = schemaClass;
        const nameToAttribute = new Map<string, SchemaAttribute>(
          (schemaClass.attributes ?? []).map(attribute => [attribute.name, attribute]));

        for (const selection of selections) {
          const attribute = nameToAttribute.get(selection.attributeName);
          if (!attribute || selection.values.length === 0)
            continue;
          if (attribute.cardinality === '1')
            merged.attributes.set(attribute.name, selection.values[0]);
          else
            merged.attributes.set(attribute.name, [...selection.values]);
        }

        new InstanceNameGenerator(this.dataService, this.instUtils).updateDisplayName(merged);
        this.dataService.registerInstance(merged);
        this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(merged)));
        return merged;
      })
    );
  }

  /**
   * Merge the source instance into the target: copy the source's values onto the target, move
   * every reference to the source over to the target, and stage the source for deletion.
   *
   * Referrers are loaded from the server first so that instances which are not already in the
   * local cache still get repointed. The target is staged as an updated instance (or is already
   * tracked, if it is a new instance) and each changed referrer is staged the same way.
   */
  mergeInto(source: Instance, target: Instance): Observable<MergeIntoResult> {
    return this.loadReferrers(source.dbId).pipe(
      map(() => {
        this.applyMergeAttributes(source, target);
        // Make sure the merged full instance is the cached one; commit pulls from the cache.
        this.dataService.registerInstance(target);
        if (target.dbId > 0)
          this.store.dispatch(UpdateInstanceActions.register_updated_instance(this.instUtils.makeShell(target)));

        const changedReferrers = this.dataService.replaceInstanceReferences(source.dbId, target);
        this.stageSourceForDeletion(source);
        return { target, changedReferrers };
      })
    );
  }

  /**
   * How many instances currently refer to the passed instance. Used to warn before a merge-into
   * rewrites a large number of referrers.
   */
  countReferrers(dbId: number): Observable<number> {
    return this.dataService.getReferrers(dbId).pipe(
      take(1),
      map(referrers => new Set((referrers ?? [])
        .flatMap(referrer => referrer.referrers ?? [])
        .map(inst => inst.dbId)).size)
    );
  }

  /**
   * Pull every referrer of the passed instance into the cache so that
   * DataService.replaceInstanceReferences(), which only walks cached instances, can see them.
   */
  private loadReferrers(dbId: number): Observable<Instance[]> {
    return this.dataService.getReferrers(dbId).pipe(
      take(1),
      concatMap(referrers => {
        const referrerDbIds = new Set<number>((referrers ?? [])
          .flatMap(referrer => referrer.referrers ?? [])
          .map(inst => inst.dbId)
          .filter(referrerDbId => referrerDbId !== undefined && referrerDbId !== dbId));
        if (referrerDbIds.size === 0)
          return of([] as Instance[]);
        return forkJoin(Array.from(referrerDbIds)
          .map(referrerDbId => this.dataService.fetchInstance(referrerDbId).pipe(take(1))));
      })
    );
  }

  /**
   * Stage the merged-away source instance for deletion. Mirrors ConfirmDeleteDialogComponent:
   * a database instance is registered as deleted (and dropped from the updated list), while an
   * uncommitted new instance is simply removed. The deletion effect takes care of notifying the
   * views, so there is no need to signal the deletion here.
   */
  private stageSourceForDeletion(source: Instance): void {
    if (source.dbId >= 0) {
      this.store.dispatch(DeleteInstanceActions.register_deleted_instance(this.instUtils.makeShell(source)));
      if (source.modifiedAttributes && source.modifiedAttributes.length > 0)
        this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instUtils.makeShell(source)));
    }
    else {
      this.dataService.discardNewInstance(source);
    }
  }

  /**
   * Apply the source instance's attribute values onto the target instance:
   * single-valued attributes are overwritten with the source value; multivalued attributes get
   * the source values appended to the end (skipping exact duplicates).
   *
   * Only attributes the target's class defines are copied, so this is safe for a source and
   * target of different (but related) classes.
   */
  applyMergeAttributes(source: Instance, target: Instance): void {
    const sourceAttributes: Map<string, any> = source.attributes;
    if (!sourceAttributes) return;
    if (!(target.attributes instanceof Map)) {
      this.dataService.handleInstanceAttributes(target);
    }
    const targetAttributes: Map<string, any> = target.attributes;

    const notClonable = this.dataService.getAttributeNamesNotClonable();
    const targetAttributeNames = new Map<string, SchemaAttribute>(
      this.getAttributes(target).map(attribute => [attribute.name, attribute]));

    for (const attribute of this.getAttributes(source)) {
      if (!this.isMergeable(attribute, notClonable)) continue;
      // Skip anything the target's class cannot hold.
      const targetAttribute = targetAttributeNames.get(attribute.name);
      if (!targetAttribute) continue;

      const newValue = sourceAttributes.get(attribute.name);
      if (newValue === undefined || newValue === null) continue;

      if (targetAttribute.cardinality === '1') {
        targetAttributes.set(attribute.name, Array.isArray(newValue) ? newValue[0] : newValue);
        this.instUtils.addToModifiedAttributes(attribute.name, target);
      } else {
        const newValues = Array.isArray(newValue) ? newValue : [newValue];
        if (newValues.length === 0) continue;
        let existingValues = targetAttributes.get(attribute.name);
        if (existingValues === undefined || existingValues === null) {
          existingValues = [];
          targetAttributes.set(attribute.name, existingValues);
        }
        // Skip values the target already holds (instances compared by dbId) so a merge never
        // introduces a duplicate. Deduping against the growing list also collapses duplicates
        // within the new values themselves. This applies to every multivalued attribute,
        // including stoichiometry relationship types (hasComponent/input/output/repeatedUnit).
        let added = false;
        for (const value of newValues) {
          if (!existingValues.some((v: any) => this.isSameValue(v, value))) {
            existingValues.push(value);
            added = true;
          }
        }
        if (added)
          this.instUtils.addToModifiedAttributes(attribute.name, target);
      }
    }
  }

  private getAttributes(instance: Instance): SchemaAttribute[] {
    const schemaClass = instance.schemaClass ?? this.dataService.getSchemaClass(instance.schemaClassName);
    return schemaClass?.attributes ?? [];
  }

  /** Mirrors AttributeEditService.isSameValue: instances compare by dbId, others by value. */
  isSameValue(left: any, right: any): boolean {
    if (left === right) {
      return true;
    }
    if (left && right && typeof left === 'object' && typeof right === 'object' && 'dbId' in left && 'dbId' in right) {
      return left.dbId === right.dbId;
    }
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
