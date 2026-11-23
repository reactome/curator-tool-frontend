import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { concatMap, Observable, of, Subject, take, throwError } from 'rxjs';
import { Instance } from '../models/reactome-instance.model';
import { AttributeCategory, SchemaAttribute } from '../models/reactome-schema.model';
import { InstanceNameGenerator } from '../post-edit/InstanceNameGenerator';
import { UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from './data.service';
import { InstanceUtilities } from './instance.service';

/**
 * Which value a merge row takes. 'both' is offered for multivalued attributes only and keeps
 * the database list, then appends the curator's values the database list does not already hold.
 */
export type DatabaseMergeChoice = 'local' | 'database' | 'both';

/** One attribute whose staged value differs from the current database value. */
export interface DatabaseMergeRow {
  attribute: SchemaAttribute;
  multiValued: boolean;
  /** The curator's staged value, normalized to an array (empty when unset). */
  localValues: any[];
  /** The current database value, normalized to an array (empty when unset). */
  databaseValues: any[];
  /**
   * True when the curator edited this attribute (it is in modifiedAttributes, or in
   * passiveModifiedAttributes because a referenced instance was deleted). False means the
   * difference came from the database side: someone committed a change to an attribute this
   * curator never touched, so the database value is the right default.
   */
  editedLocally: boolean;
  /**
   * True for an attribute curators cannot edit by hand (NOMANUALEDIT in this class, plus the
   * provenance slots in {@link ALWAYS_DATABASE}). A locked row always takes the database value:
   * these values are written by the backend or by the tool itself (InstanceEdits, stable
   * identifiers, release data), so the copy in the database is the authoritative one, and keeping
   * the staged copy's `modified` would get the commit refused with the same 409 again. Curators
   * asked for exactly this: "for nomanualedits only take database version, not other way".
   */
  locked: boolean;
  choice: DatabaseMergeChoice;
}

/** Everything the merge in the comparison table needs, built from a fresh database read. */
export interface DatabaseMergeData {
  /** The staged copy, as held in DataService.id2instance. */
  local: Instance;
  /** The database copy read just now, with its current `modified` InstanceEdit. */
  database: Instance;
  rows: DatabaseMergeRow[];
}

/** What applying a merge did, so the caller can tell the curator. */
export interface DatabaseMergeOutcome {
  instance: Instance;
  /** False when every row took the database value: nothing is left to commit. */
  stillStaged: boolean;
}

/**
 * A request to show the merge for an instance. Raised by the instance view's merge button and by a
 * single commit refused with 409, and consumed by the instance view, which shows the merge in its
 * database comparison table.
 */
export interface DatabaseMergeRequest {
  dbId: number;
  /** Shown at the top of the merge, e.g. why a commit was rejected. */
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
 * Attributes the merge never lists. displayName is regenerated from the merged values instead of
 * being picked.
 */
const NOT_MERGEABLE = new Set(['dbId', 'DB_ID', 'displayName']);

/**
 * Attributes that always take the database value, whatever their category in the loaded schema.
 * They are NOMANUALEDIT in the backend's schema already; this is a guard in case the category is
 * missing. `modified` is what the backend's commit conflict check reads
 * (CurationService.isConflictWithStored compares the staged `modified` InstanceEdit with the
 * stored one), and `modifiedList` grows with it on every commit. Until 2026-11-23 these were hidden
 * from the merge instead; they are listed now, locked, so the curator can see that the database's
 * InstanceEdits are what gets committed.
 */
const ALWAYS_DATABASE = new Set(['created', 'modified', 'modifiedList']);

/**
 * Merges a staged (updated) instance with the current database copy of the same instance.
 *
 * Why this exists: an updated instance is staged with the `modified` InstanceEdit it had when the
 * curator first edited it. If anyone commits that instance in the meantime (another curator, or
 * the same curator from another tab), the backend rejects every later commit of the staged copy
 * with 409 "Instance has been updated elsewhere". Before this tool the only way out was Undo,
 * which threw the curator's edits away.
 *
 * There is no stored snapshot of the database copy at the time of staging (Instance.source is
 * only set transiently by the view filters), so this is not a true three-way merge. It uses
 * modifiedAttributes as the stand-in for the base: an attribute the curator edited defaults to
 * the curator's value, and an attribute they did not edit defaults to the database's value. The
 * merged instance starts from the database copy, so it carries the current `modified` and passes
 * the backend's conflict check.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseMergeService {

  private readonly nameGenerator: InstanceNameGenerator;

  /**
   * The request raised most recently and not yet taken. Kept in addition to the Subject below
   * because the requester usually navigates to the comparison URL, which is a different route
   * from the plain instance URL and so creates a new InstanceViewComponent: that component does
   * not exist yet when the request is raised, and takes it from here once its comparison loads.
   */
  private pending?: { request: DatabaseMergeRequest; at: number };
  private mergeRequest = new Subject<DatabaseMergeRequest>();
  /** Emits each request, for an instance view that already shows the comparison it is for. */
  readonly mergeRequest$ = this.mergeRequest.asObservable();

  constructor(private dataService: DataService,
    private instUtils: InstanceUtilities,
    private store: Store) {
    this.nameGenerator = new InstanceNameGenerator(dataService, instUtils);
  }

  /**
   * Ask the instance view to show the merge for an instance. The caller then opens the database
   * comparison for that instance; see {@link pending}.
   */
  requestMerge(dbId: number, reason?: string): void {
    const request = { dbId, reason };
    this.pending = { request, at: Date.now() };
    this.mergeRequest.next(request);
  }

  /** Take the pending request for this instance, if there is a fresh one. Taking it clears it. */
  takeRequest(dbId: number): DatabaseMergeRequest | undefined {
    const pending = this.pending;
    if (!pending || pending.request.dbId !== dbId)
      return undefined;
    this.pending = undefined;
    return Date.now() - pending.at <= REQUEST_TTL_MS ? pending.request : undefined;
  }

  /**
   * Read the current database copy of a staged instance and work out which attributes differ.
   * The database copy is fetched with cache=false so the staged copy in id2instance is left alone
   * until the curator confirms the merge.
   */
  prepare(dbId: number): Observable<DatabaseMergeData> {
    const local = this.dataService.getCachedInstance(dbId);
    if (!local)
      return throwError(() => new DatabaseMergeError(`Your staged copy of instance ${dbId} is not loaded in this window. ` +
        'Open the instance, then try the merge again.'));
    if (dbId < 0)
      return throwError(() => new DatabaseMergeError('A new instance has no database copy to merge with.'));
    return this.dataService.handleSchemaClassForInstance(local).pipe(
      take(1),
      concatMap(loadedLocal => this.dataService.fetchInstanceFromDatabase(dbId, false).pipe(
        take(1),
        concatMap(database => {
          if (!database)
            return throwError(() => new DatabaseMergeError(`Instance ${dbId} is no longer in the database. ` +
              'It may have been deleted, so there is nothing to merge with.'));
          if (database.schemaClassName !== loadedLocal.schemaClassName)
            return throwError(() => new DatabaseMergeError(
              `The class of instance ${dbId} differs: ${loadedLocal.schemaClassName} in your copy, ` +
              `${database.schemaClassName} in the database. The merge tool cannot combine two classes. ` +
              'Use Undo to reload the database copy and redo your edits.'));
          return of({ local: loadedLocal, database, rows: this.buildRows(loadedLocal, database) });
        })
      ))
    );
  }

  buildRows(local: Instance, database: Instance): DatabaseMergeRow[] {
    const schemaClass = local.schemaClass ?? this.dataService.getSchemaClass(local.schemaClassName);
    const edited = new Set<string>([
      ...(local.modifiedAttributes ?? []),
      ...(local.passiveModifiedAttributes ?? [])
    ]);
    const rows: DatabaseMergeRow[] = [];
    for (const attribute of schemaClass?.attributes ?? []) {
      if (NOT_MERGEABLE.has(attribute.name))
        continue;
      const localValues = this.toValues(local, attribute.name);
      const databaseValues = this.toValues(database, attribute.name);
      if (this.isSameList(localValues, databaseValues))
        continue;
      const row: DatabaseMergeRow = {
        attribute,
        multiValued: attribute.cardinality !== '1',
        localValues,
        databaseValues,
        editedLocally: edited.has(attribute.name),
        locked: this.isLocked(attribute),
        choice: 'database'
      };
      row.choice = this.defaultChoice(row);
      rows.push(row);
    }
    return rows;
  }

  /** See {@link DatabaseMergeRow.locked}. */
  isLocked(attribute: SchemaAttribute): boolean {
    return ALWAYS_DATABASE.has(attribute.name) || attribute.category === AttributeCategory.NOMANUALEDIT;
  }

  /** The curator's value where they edited, the database value elsewhere and on locked rows. */
  defaultChoice(row: DatabaseMergeRow): DatabaseMergeChoice {
    return row.editedLocally && !row.locked ? 'local' : 'database';
  }

  /** Set a row's choice. Locked rows keep the database value whatever is asked for. */
  choose(row: DatabaseMergeRow, choice: DatabaseMergeChoice): void {
    row.choice = row.locked ? 'database' : choice;
  }

  /**
   * True when the staged copy was staged against an older database copy than the current one, so
   * the backend will refuse to commit it (409 "Instance has been updated elsewhere"). This is the
   * front-end mirror of CurationService.isConflictWithStored, which compares the dbId of the staged
   * `modified` InstanceEdit with the stored one. `modifiedList` is compared as well (in order, by
   * dbId), since every commit appends to it; it is compared only when both copies carry the slot,
   * so a copy loaded without it is not reported as out of sync on that account alone.
   *
   * The merge button is offered only when this is true: merging a copy that is in sync would only
   * throw edits away (curators asked for the merge to appear only once edits are out of sync).
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
   * Build the merged instance: the database copy with the chosen values applied. It is not
   * registered anywhere yet; see {@link apply}.
   */
  merge(data: DatabaseMergeData): Instance {
    const { local, database, rows } = data;
    const merged: Instance = {
      dbId: database.dbId,
      schemaClassName: database.schemaClassName,
      schemaClass: local.schemaClass,
      displayName: database.displayName,
      attributes: new Map<string, any>(database.attributes ?? new Map()),
    };
    const changed: string[] = [];
    for (const row of rows) {
      const values = this.mergedValues(row);
      if (this.isSameList(values, row.databaseValues))
        continue;
      changed.push(row.attribute.name);
      if (values.length === 0)
        merged.attributes.delete(row.attribute.name);
      else
        merged.attributes.set(row.attribute.name, row.multiValued ? values : values[0]);
    }
    // Keep passive flags only for attributes still differing from the database, so the editor
    // marks them the way it did before the merge.
    const passive = (local.passiveModifiedAttributes ?? []).filter(name => changed.includes(name));
    if (passive.length > 0)
      merged.passiveModifiedAttributes = passive;
    merged.modifiedAttributes = changed;

    if (changed.length > 0) {
      // generateDisplayName has no side effects (unlike updateDisplayName, which broadcasts).
      // Fall back to the curator's name if the generator has nothing for this class.
      const generated = this.nameGenerator.generateDisplayName(merged);
      const name = generated && generated !== 'unknown' ? generated : (local.displayName ?? database.displayName);
      if (name !== database.displayName) {
        merged.displayName = name;
        merged.attributes.set('displayName', name);
        merged.modifiedAttributes = [...changed, 'displayName'];
      }
    }
    return merged;
  }

  /**
   * Replace the staged copy with the merged instance in this window and every other open window.
   * When nothing differs from the database any more, the instance leaves the updated list.
   */
  apply(data: DatabaseMergeData): DatabaseMergeOutcome {
    const merged = this.merge(data);
    this.dataService.registerInstance(merged);
    this.instUtils.registerDisplayNameChange(merged);
    const stillStaged = (merged.modifiedAttributes?.length ?? 0) > 0;
    if (stillStaged) {
      // The standard edit path: upserts the shell in updated_instances and, through the
      // last_updated_instance effect, pushes the full merged instance to the other windows
      // (their id2instance still holds the stale copy with the old `modified`).
      this.instUtils.registerUpdatedInstance(merged.modifiedAttributes![0], merged);
    } else {
      // Every row took the database value. Drop the instance from the list; the other windows
      // clear their cached copy on remove_updated_instance and reload it from the database.
      this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instUtils.makeShell(merged)));
    }
    this.instUtils.setRefreshViewDbId(merged.dbId);
    return { instance: merged, stillStaged };
  }

  /**
   * The merge is shown in the instance view rather than a modal dialog, so the staged copy can
   * change while the curator is still choosing: an edit in another window, or in another panel of
   * this one (the event view's diagram, for instance). The rows hold a snapshot of the staged
   * values, and applying them would silently undo that edit.
   *
   * Returns undefined when the staged copy still matches the rows. Otherwise returns the rows
   * rebuilt against the current staged copy, keeping the curator's choice on each row whose values
   * did not change; changed and new rows get their defaults.
   */
  refreshIfStale(data: DatabaseMergeData): DatabaseMergeData | undefined {
    const current = this.dataService.getCachedInstance(data.local.dbId) ?? data.local;
    const rebuilt = this.buildRows(current, data.database);
    const previous = new Map(data.rows.map(row => [row.attribute.name, row]));
    let stale = rebuilt.length !== data.rows.length;
    for (const row of rebuilt) {
      const old = previous.get(row.attribute.name);
      if (old && this.isSameList(old.localValues, row.localValues) && old.editedLocally === row.editedLocally)
        row.choice = old.choice;
      else
        stale = true;
    }
    return stale ? { local: current, database: data.database, rows: rebuilt } : undefined;
  }

  mergedValues(row: DatabaseMergeRow): any[] {
    if (row.locked)
      return [...row.databaseValues];
    switch (row.choice) {
      case 'local':
        return [...row.localValues];
      case 'database':
        return [...row.databaseValues];
      case 'both':
        return this.unionKeepingMultiplicity(row.databaseValues, row.localValues);
    }
  }

  /**
   * The database list, then the curator's values it lacks. Multiplicity counts: a value that
   * appears twice in the curator's list and once in the database list is appended once more.
   * Reaction inputs/outputs and Complex components encode stoichiometry by repeating a value, so
   * a plain set union would quietly change stoichiometry.
   */
  unionKeepingMultiplicity(databaseValues: any[], localValues: any[]): any[] {
    const result = [...databaseValues];
    for (const value of localValues) {
      const inResult = result.filter(v => this.isSameValue(v, value)).length;
      const inLocal = localValues.filter(v => this.isSameValue(v, value)).length;
      if (inResult < inLocal)
        result.push(value);
    }
    return result;
  }

  /** Lists compare in order; order is meaningful for e.g. hasEvent and author lists. */
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
 * A reason the merge cannot be prepared, as opposed to an HTTP failure (which DataService has
 * already reported in the error banner).
 */
export class DatabaseMergeError extends Error {}

/**
 * Shown when a commit is refused with 409 "Instance has been updated elsewhere". The instance view adds
 * a pointer to its merge button while the merge is not open yet.
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
