import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Instance } from '../models/reactome-instance.model';
import { AttributeCategory, SchemaAttribute } from '../models/reactome-schema.model';

/**
 * A request to show the database comparison for an instance, with a note on why. Raised when a
 * commit is refused with 409, by the instance view itself or by the Local Changes list, and
 * consumed by the instance view that ends up showing the comparison.
 */
export interface DatabaseComparisonRequest {
  dbId: number;
  /** Shown above the comparison, e.g. why a commit was rejected. */
  reason?: string;
}

/**
 * How long a request waits for an instance view to pick it up. The requester navigates to (or, in
 * the event view, loads) the comparison right after raising the request, so a view that is going
 * to take it does so within a load. A request nobody took must not surface minutes later, when
 * the curator opens the comparison for some unrelated reason.
 */
const REQUEST_TTL_MS = 30_000;

/**
 * Provenance slots written by the backend on every commit. They are NOMANUALEDIT in the backend's
 * schema already; this is a guard in case the category is missing from the loaded schema, since
 * these are the very slots the lock exists for (see {@link DatabaseSyncService.isLockable}).
 */
const PROVENANCE_ATTRIBUTES = new Set(['created', 'modified', 'modifiedList']);

/**
 * Keeps a staged (updated) instance in step with the database copy of the same instance.
 *
 * Why this exists: an updated instance is staged with the `modified` InstanceEdit it had when the
 * curator first edited it. If anyone commits that instance in the meantime (another curator, or
 * the same curator from another tab), the backend rejects every later commit of the staged copy
 * with 409 "Instance has been updated elsewhere". The backend also saves the whole staged instance,
 * not just the edited attributes, so even without the 409 a stale staged copy would overwrite
 * whatever the other commit changed, and drop that commit's InstanceEdit from `modifiedList`.
 *
 * History: until 2026-11-24 this was DatabaseMergeService, which built a dedicated merge in the
 * comparison table (a Take column with Mine / Both / Database per attribute, and Apply Merge).
 * Curators preferred to reuse the comparison's own "reset to the db value" button instead: the
 * instance table now locks the NOMANUALEDIT attributes that differ from the database (chiefly
 * `modified` and `modifiedList`), the curator unlocks the ones to bring in line and reverts them,
 * and attributes changed only on the database side get the same revert button. That made the
 * merge's all-or-none handling of NOMANUALEDIT attributes go away as well. What is left here is
 * the out-of-sync test, the per-attribute difference test, and the hand-off of a refused commit
 * to the comparison.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseSyncService {

  /**
   * The request raised most recently and not yet taken. Kept in addition to the Subject below
   * because the requester usually navigates to the comparison URL, which is a different route
   * from the plain instance URL and so creates a new InstanceViewComponent: that component does
   * not exist yet when the request is raised, and takes it from here once its comparison loads.
   */
  private pending?: { request: DatabaseComparisonRequest; at: number };
  private comparisonRequest = new Subject<DatabaseComparisonRequest>();
  /** Emits each request, for an instance view that already shows the comparison it is for. */
  readonly comparisonRequest$ = this.comparisonRequest.asObservable();

  /**
   * Ask the instance view to show the database comparison for an instance, with a note. The
   * caller then opens that comparison; see {@link pending}.
   */
  requestComparison(dbId: number, reason?: string): void {
    const request = { dbId, reason };
    this.pending = { request, at: Date.now() };
    this.comparisonRequest.next(request);
  }

  /** Take the pending request for this instance, if there is a fresh one. Taking it clears it. */
  takeRequest(dbId: number): DatabaseComparisonRequest | undefined {
    const pending = this.pending;
    if (!pending || pending.request.dbId !== dbId)
      return undefined;
    this.pending = undefined;
    return Date.now() - pending.at <= REQUEST_TTL_MS ? pending.request : undefined;
  }

  /**
   * True when the staged copy was staged against an older database copy than the current one, so
   * the backend will refuse to commit it (409 "Instance has been updated elsewhere"). This is the
   * front-end mirror of CurationService.isConflictWithStored, which compares the dbId of the staged
   * `modified` InstanceEdit with the stored one. `modifiedList` is compared as well (in order, by
   * dbId), since every commit appends to it; it is compared only when both copies carry the slot,
   * so a copy loaded without it is not reported as out of sync on that account alone.
   */
  isOutOfSync(local: Instance, database: Instance): boolean {
    if (!local || !database || local.dbId <= 0 || local.dbId !== database.dbId)
      return false;
    const ids = (instance: Instance, name: string) => this.toValues(instance, name).map(v => v?.dbId ?? v);
    const localModified = ids(local, 'modified');
    const databaseModified = ids(database, 'modified');
    if (localModified[0] !== databaseModified[0])
      return true;
    const hasList = (instance: Instance) => instance.attributes?.has?.('modifiedList') ?? false;
    if (hasList(local) && hasList(database)) {
      const localList = ids(local, 'modifiedList');
      const databaseList = ids(database, 'modifiedList');
      return localList.length !== databaseList.length || localList.some((id, i) => id !== databaseList[i]);
    }
    return false;
  }

  /**
   * True when an attribute holds a different value in the two copies. Unset, null, empty string
   * and an empty list all count as "no value", so a slot one copy carries as [] and the other
   * omits is not a difference. Lists compare in order (order is meaningful for e.g. hasEvent and
   * author lists, and repeats encode stoichiometry); instances compare by dbId.
   */
  differsFromDatabase(local: Instance | undefined, database: Instance | undefined, attributeName: string): boolean {
    if (!local || !database)
      return false;
    return !this.isSameList(this.toValues(local, attributeName), this.toValues(database, attributeName));
  }

  /**
   * Whether an attribute is one the comparison locks when it differs from the database: the ones
   * curators cannot edit by hand (NOMANUALEDIT in this class, plus the provenance slots in
   * {@link PROVENANCE_ATTRIBUTES}). Their values are written by the backend or by the tool itself,
   * so they are not offered for revert until the curator unlocks them on purpose.
   */
  isLockable(attribute: SchemaAttribute): boolean {
    return PROVENANCE_ATTRIBUTES.has(attribute.name) || attribute.category === AttributeCategory.NOMANUALEDIT;
  }

  /**
   * The attribute that must be locked, unlocked and reset together with this one, if any.
   *
   * Database contract: `modified` is always the same InstanceEdit as the last entry of
   * `modifiedList`. The backend keeps it on commit by appending the new InstanceEdit to the staged
   * `modifiedList` and setting `modified` to it (DatabaseObjectInstanceConverter.convert), so the
   * staged pair must go in consistent. Resetting them one at a time breaks that:
   * - `modified` alone: the commit passes the conflict check (it reads `modified` only), but the
   *   backend writes the stale `modifiedList` plus the new InstanceEdit, dropping the other
   *   commit's InstanceEdit from the history.
   * - `modifiedList` alone: the staged `modified` no longer matches the end of its own list, and
   *   the commit is still refused with 409.
   */
  provenancePartner(attributeName: string): string | undefined {
    if (attributeName === 'modified')
      return 'modifiedList';
    if (attributeName === 'modifiedList')
      return 'modified';
    return undefined;
  }

  isSameList(left: any[], right: any[]): boolean {
    if (left.length !== right.length)
      return false;
    return left.every((value, i) => this.isSameValue(value, right[i]));
  }

  /** Instances compare by dbId, everything else by value. Mirrors InstanceMergeService. */
  isSameValue(left: any, right: any): boolean {
    if (left === right)
      return true;
    if (left && right && typeof left === 'object' && typeof right === 'object' && 'dbId' in left && 'dbId' in right)
      return left.dbId === right.dbId;
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private toValues(instance: Instance, attributeName: string): any[] {
    const value = instance.attributes?.get?.(attributeName);
    if (value === undefined || value === null)
      return [];
    const values = Array.isArray(value) ? value : [value];
    return values.filter(v => v !== undefined && v !== null && v !== '');
  }
}

/**
 * Shown when a commit is refused with 409 "Instance has been updated elsewhere".
 */
export const COMMIT_REFUSED_REASON =
  'The commit was rejected because this instance was changed in the database after you started editing it.';

/**
 * True when a commit failed because the instance was committed elsewhere after it was staged:
 * the backend's InstanceChangedException, returned as 409 with this message.
 */
export function isInstanceChangedError(error: any): boolean {
  const message: string = error?.message ?? '';
  return message.includes('updated elsewhere');
}
