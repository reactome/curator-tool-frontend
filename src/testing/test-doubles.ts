/**
 * Spy factories for the services nearly every component here injects.
 *
 * Each factory returns a `jasmine.SpyObj` with *safe default return values* already set.
 * That default-return part is the point: a bare `createSpyObj` returns `undefined` from
 * every method, and a component that does `this.dataService.listInstances(...).subscribe(...)`
 * then dies in `ngOnInit` with "cannot read property subscribe of undefined" -- a failure that
 * looks like a component bug but is really a missing stub. Defaults here mean a spec only has
 * to override the one call it is actually testing.
 */

import { Instance, InstanceList, UserInstances } from '../app/core/models/reactome-instance.model';
import { SchemaClass } from '../app/core/models/reactome-schema.model';
import { AttributeEditService } from '../app/core/services/attribute-edit.service';
import { AuthenticateService } from '../app/core/services/authenticate.service';
import { DataService } from '../app/core/services/data.service';
import { InstanceUtilities } from '../app/core/services/instance.service';
import { PostEditService } from '../app/core/services/post-edit.service';
import { EMPTY, of, Subject } from 'rxjs';

import {
  EMPTY_INSTANCE_LIST,
  flattenSchemaTree,
  makeInstance,
  makeSchemaClass,
  makeSchemaClassTree,
  makeUserInstances
} from './fixtures';

/**
 * A DataService spy wired against `makeSchemaClassTree()`, so the class-predicate methods
 * (`isEventClass`, `isPhysicalEntityClass`, ...) answer correctly for the standard fixture
 * classes instead of always returning false.
 */
export function createDataServiceSpy(overrides: Partial<DataService> = {}): jasmine.SpyObj<DataService> {
  const spy = jasmine.createSpyObj<DataService>('DataService', [
    'initialize', 'isSchemaClassesLoaded', 'flagSchemaTreeForReload',
    'fetchSchemaClass', 'fetchSchemaClasses', 'fetchSchemaClassTree', 'fetchEventTree',
    'getSchemaClass', 'isEventClass', 'isPhysicalEntityClass', 'isRegulationClass',
    'isReferenceGeneProductClass', 'isSchemaClass',
    'fetchInstance', 'fetchInstances', 'fetchInstanceFromDatabase', 'fetchReactionParticipants',
    'fetchBookmarkShell', 'fetchRawDiagram', 'fetchDisplayNamesByDbIds',
    'fetchReactionStructuresByDbIds', 'fetchModifiedResiduesByDbIds',
    'getNextNewDbId', 'resetNextNewDbId', 'createNewInstance', 'cloneInstance',
    'getAttributeNamesNotClonable', 'registerInstance', 'getCachedInstance',
    'removeInstanceInCache', 'remapNewInstanceReferenceDbId', 'replaceInstanceReferences',
    'discardNewInstance', 'handleInstanceAttributes', 'handleSchemaClassForInstance',
    'listInstances', 'searchInstances', 'findInstanceByDisplayName',
    'startLoadInstances', 'getLoadInstanceSubject', 'stopLoadInstance',
    'loadUserInstances', 'persistUserInstancesBeacon', 'persitUserInstances',
    'listUserInstanceBackups', 'loadUserInstanceBackup', 'hydrateUserInstances',
    'computePersistPayload', 'setLastPersistedPayload', 'deletePersistedInstances',
    'commit', 'fillReference', 'chebiAutoFiller', 'externalOntologyFiller',
    'fillReferenceSequence', 'matchInstances', 'setCandidateClasses', 'grepConcreteClasses',
    'testQACheckReport', 'delete', 'deleteByDeleted', 'getReferrers',
    'synchronizeDeletedReferrers', 'shouldCheckForMatches', 'handleErrorMessage',
    'fetchQAReport', 'doubleArrayToDataSource', 'exportEventDocx'
  ]);

  const tree = makeSchemaClassTree();
  const byName = flattenSchemaTree(tree);
  const isDescendantOf = (clsName: string, ancestor: string) =>
    byName.get(ancestor)?.descendants?.has(clsName) ?? false;

  // Schema
  spy.initialize.and.returnValue(Promise.resolve());
  spy.isSchemaClassesLoaded.and.returnValue(true);
  spy.fetchSchemaClassTree.and.returnValue(of(tree));
  spy.fetchSchemaClass.and.callFake((name: string) => of(byName.get(name) ?? makeSchemaClass(name)));
  spy.fetchSchemaClasses.and.callFake((names: string[]) =>
    of(names.map(n => byName.get(n) ?? makeSchemaClass(n))));
  spy.getSchemaClass.and.callFake((name: string) => byName.get(name) ?? makeSchemaClass(name));
  spy.isEventClass.and.callFake((name: string) => isDescendantOf(name, 'Event'));
  spy.isPhysicalEntityClass.and.callFake((name: string) => isDescendantOf(name, 'PhysicalEntity'));
  spy.isRegulationClass.and.callFake((name: string) => isDescendantOf(name, 'Regulation'));
  spy.isReferenceGeneProductClass.and.callFake((name: string) =>
    isDescendantOf(name, 'ReferenceGeneProduct'));
  spy.isSchemaClass.and.callFake((inst: Instance, name: string) =>
    isDescendantOf(inst.schemaClassName, name));
  spy.setCandidateClasses.and.returnValue([]);

  // Instances
  spy.fetchInstance.and.callFake((dbId: number) => of(makeInstance({ dbId })));
  spy.fetchInstanceFromDatabase.and.callFake((dbId: number) => of(makeInstance({ dbId })));
  spy.fetchInstances.and.returnValue(of([]));
  spy.fetchReactionParticipants.and.callFake((dbId: number) => of(makeInstance({ dbId })));
  spy.fetchBookmarkShell.and.returnValue(of(undefined));
  spy.getCachedInstance.and.returnValue(undefined);
  spy.getNextNewDbId.and.returnValue(Promise.resolve(-1));
  spy.createNewInstance.and.callFake((schemaClassName: string) =>
    of(makeInstance({ dbId: -1, displayName: 'To be generated', schemaClassName })));
  spy.cloneInstance.and.callFake((inst: Instance) => of(makeInstance({ ...inst, dbId: -1 })));
  spy.getAttributeNamesNotClonable.and.returnValue([]);
  spy.handleSchemaClassForInstance.and.callFake((inst: Instance) => of(inst));
  spy.replaceInstanceReferences.and.returnValue([]);

  // Lists and search
  spy.listInstances.and.returnValue(of(EMPTY_INSTANCE_LIST) as any);
  spy.searchInstances.and.returnValue(of(EMPTY_INSTANCE_LIST) as any);
  spy.findInstanceByDisplayName.and.returnValue(of(EMPTY_INSTANCE_LIST) as any);
  spy.getLoadInstanceSubject.and.returnValue(undefined as any);

  // Bulk lookups return empty maps, not undefined -- callers iterate them.
  spy.fetchDisplayNamesByDbIds.and.returnValue(of(new Map<number, string>()));
  spy.fetchReactionStructuresByDbIds.and.returnValue(of(new Map()) as any);
  spy.fetchModifiedResiduesByDbIds.and.returnValue(of(new Map()) as any);

  // Staged edits
  spy.loadUserInstances.and.returnValue(of(makeUserInstances()));
  spy.hydrateUserInstances.and.callFake((u: UserInstances) => of(u));
  spy.persitUserInstances.and.returnValue(of({}));
  spy.listUserInstanceBackups.and.returnValue(of([]));
  spy.loadUserInstanceBackup.and.returnValue(of(makeUserInstances()));
  spy.deletePersistedInstances.and.returnValue(of({}));
  spy.computePersistPayload.and.returnValue('{}');

  // Writes. `commit` echoing the instance back is the shape processCommit expects.
  spy.commit.and.callFake((inst: Instance) => of(inst));
  spy.delete.and.returnValue(of(true));
  spy.deleteByDeleted.and.returnValue(of(true));
  spy.matchInstances.and.returnValue(of([]));
  spy.shouldCheckForMatches.and.returnValue(false);
  spy.fillReference.and.callFake((inst: Instance) => of(inst));
  spy.chebiAutoFiller.and.callFake((inst: Instance) => of(inst));
  spy.externalOntologyFiller.and.callFake((inst: Instance) => of(inst));
  spy.fillReferenceSequence.and.callFake((inst: Instance) => of(inst));

  // Referrers and QA
  spy.getReferrers.and.returnValue(of([]));
  spy.synchronizeDeletedReferrers.and.returnValue(of([]));
  spy.testQACheckReport.and.returnValue(of([]) as any);
  spy.doubleArrayToDataSource.and.returnValue([]);

  // Not in the spy list because it is a field, not a method.
  (spy as any).errorMessage$ = EMPTY;

  Object.assign(spy, overrides);
  return spy;
}

/**
 * The event Subjects on `InstanceUtilities` that components subscribe to in `ngOnInit`.
 * Exposed so a spec can push a value through one: `utils.deletedDbId.next(123)`.
 */
export interface InstanceUtilitiesSubjects {
  lastClickedDbId: Subject<string | number>;
  refreshViewDbId: Subject<number>;
  refreshBookmarks: Subject<number>;
  markDeletionDbId: Subject<number>;
  deletedDbId: Subject<number>;
  resetDeletedDbId: Subject<number>;
  committedNewInstDbId: Subject<[number, number]>;
  lastClickedDbIdForComparison: Subject<number>;
  resetInst: Subject<{ modifiedAttributes: string[] | undefined, dbId: number }>;
  lastUpdatedInstance: Subject<{ attribute: string, instance: Instance }>;
}

export type InstanceUtilitiesSpy = jasmine.SpyObj<InstanceUtilities> & {
  /** The backing Subjects, for driving the `*$` observables the component subscribed to. */
  subjects: InstanceUtilitiesSubjects;
};

/**
 * An InstanceUtilities spy whose `*$` observables are live Subjects rather than `of()`.
 * A completed observable is not good enough here: components subscribe in `ngOnInit` and the
 * spec needs to emit *after* setup to test the reaction.
 */
export function createInstanceUtilitiesSpy(
  overrides: Partial<InstanceUtilities> = {}
): InstanceUtilitiesSpy {
  const spy = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities', [
    'registerDisplayNameChange', 'syncDisplayNameCache', 'registerUpdatedInstance',
    'setLastUpdatedInstance', 'setCommittedNewInstDbId', 'setDeletedDbId',
    'setResetDeletedDbId', 'isPermanentlyRemovedNewInstance', 'setMarkDeletionDbId',
    'setResetInstance', 'setRefreshViewDbId', 'setLastClickedDbId',
    'setLastClickedDbIdForComparison', 'addHelpersToReaction', 'grepReactomeParticipantIds',
    'fillRenderInfoForReactionParticipants', '_isSchemaClass', 'isDescendantSchemaClass',
    'isSchemaClass', 'isClassAllowedForAttribute', 'changeSchemaClass', 'getAllowedClasses',
    'convertToSchemaClass', 'copyData', 'cloneInstance', 'handleInstanceAttributes',
    'stringifyInstance', 'stringifyInstances', 'makeShell', 'refreshShellInstance',
    'getShellInstance', 'copyAttributesFromRefGeneProductToEwas',
    'buildCommitSummaryResults', 'rememberPreCommitDisplayNames', 'removeInstInArray',
    'applyLocalDeletions', 'isReferrer', 'removeReference', 'addToPassiveModifiedAttributes',
    'addToModifiedAttributes', 'removeModifiedAttribute', 'mergeLocalChangesToEventTree',
    'toEventTreeInstance', 'cloneInstanceForCommit', 'isInstance', 'isChanged',
    'processCommit', 'commitNewInstances', 'initialzeSelectedInstances',
    'getSelectedInstances', 'addSelectedInstance', 'removeSelectedInstance',
    'clearSelectedInstances', 'isInstanceSelected'
  ]);

  const subjects: InstanceUtilitiesSubjects = {
    lastClickedDbId: new Subject(),
    refreshViewDbId: new Subject(),
    refreshBookmarks: new Subject(),
    markDeletionDbId: new Subject(),
    deletedDbId: new Subject(),
    resetDeletedDbId: new Subject(),
    committedNewInstDbId: new Subject(),
    lastClickedDbIdForComparison: new Subject(),
    resetInst: new Subject(),
    lastUpdatedInstance: new Subject()
  };

  Object.assign(spy, {
    lastClickedDbId$: subjects.lastClickedDbId.asObservable(),
    refreshViewDbId$: subjects.refreshViewDbId.asObservable(),
    refreshBookmarks$: subjects.refreshBookmarks.asObservable(),
    markDeletionDbId$: subjects.markDeletionDbId.asObservable(),
    deletedDbId$: subjects.deletedDbId.asObservable(),
    resetDeletedDbId$: subjects.resetDeletedDbId.asObservable(),
    committedNewInstDbId$: subjects.committedNewInstDbId.asObservable(),
    lastClickedDbIdForComparison$: subjects.lastClickedDbIdForComparison.asObservable(),
    resetInst$: subjects.resetInst.asObservable(),
    lastUpdatedInstance$: subjects.lastUpdatedInstance.asObservable()
  });

  spy.isChanged.and.returnValue(false);
  spy.isInstance.and.callFake((v: any) => !!v && typeof v === 'object' && 'dbId' in v);
  spy.isPermanentlyRemovedNewInstance.and.returnValue(false);
  spy.isReferrer.and.returnValue(false);
  spy.isInstanceSelected.and.returnValue(false);
  spy.applyLocalDeletions.and.returnValue(false);
  spy.getSelectedInstances.and.returnValue(of([]) as any);
  spy.grepReactomeParticipantIds.and.returnValue([]);
  spy.getAllowedClasses.and.returnValue([]);
  spy.buildCommitSummaryResults.and.returnValue([]);
  spy.cloneInstance.and.callFake((inst: Instance) => ({ ...inst }));
  spy.cloneInstanceForCommit.and.callFake((inst: Instance) => ({ ...inst }));
  spy.toEventTreeInstance.and.callFake((inst: Instance) => inst);
  spy.getShellInstance.and.callFake((inst: Instance) => inst);
  spy.stringifyInstance.and.returnValue('{}');
  spy.stringifyInstances.and.returnValue('[]');
  spy.copyData.and.callFake((d: any) => d);
  spy.fillRenderInfoForReactionParticipants.and.returnValue(of(undefined));
  spy.isClassAllowedForAttribute.and.returnValue(true);
  spy._isSchemaClass.and.returnValue(false);
  spy.isDescendantSchemaClass.and.returnValue(false);
  spy.isSchemaClass.and.returnValue(false);

  Object.assign(spy, overrides);
  return Object.assign(spy, { subjects }) as InstanceUtilitiesSpy;
}

/** An AuthenticateService spy. Defaults to a logged-in user named `test_curator`. */
export function createAuthServiceSpy(
  user: string | undefined = 'test_curator'
): jasmine.SpyObj<AuthenticateService> {
  const spy = jasmine.createSpyObj<AuthenticateService>('AuthenticateService', [
    'login', 'logout', 'isAuthenticated', 'getUser', 'getUserCandidates'
  ]);
  spy.login.and.returnValue(of('token'));
  spy.logout.and.returnValue(of({}));
  spy.isAuthenticated.and.returnValue(user !== undefined);
  spy.getUser.and.returnValue(user);
  spy.getUserCandidates.and.returnValue([]);
  return spy;
}

/**
 * An AttributeEditService spy.
 *
 * The `true` defaults on the boolean-returning methods matter: the edit components read a
 * falsy result as "the instance already held this value" and silently skip the rest of the
 * edit, so a spy left returning `undefined` makes a successful edit look like a no-op and the
 * spec fails on an assertion about the *next* step.
 */
export function createAttributeEditServiceSpy(): jasmine.SpyObj<AttributeEditService> {
  const spy = jasmine.createSpyObj<AttributeEditService>('AttributeEditService', [
    'deleteInstanceAttribute', 'deleteAllInstanceOccurrences', 'replaceStoichiometryGroup',
    'addValueToAttributeInBatch', 'addValueToAttribute', 'addInstanceViaSelect',
    'setInstanceStoichiometry', 'onNoInstanceAttributeEdit', 'deleteAttributeValue',
    'addModifiedAttribute', 'removeModifiedAttribute', 'removeDisplayNameModifiedAttribute',
    'resetAttributeValue'
  ]);
  spy.addValueToAttribute.and.returnValue(true);
  spy.addInstanceViaSelect.and.returnValue(true);
  spy.setInstanceStoichiometry.and.returnValue(true);
  spy.onNoInstanceAttributeEdit.and.returnValue(true);
  return spy;
}

/** A PostEditService spy. `postEdit` is a void no-op, matching the real signature. */
export function createPostEditServiceSpy(): jasmine.SpyObj<PostEditService> {
  return jasmine.createSpyObj<PostEditService>('PostEditService', ['postEdit']);
}

/**
 * A minimal MatDialogRef double. `afterClosed()` emits `result` once, so a component that
 * chains off a dialog close runs its handler.
 */
export function createDialogRefSpy<T = any>(result?: T) {
  return {
    close: jasmine.createSpy('close'),
    afterClosed: () => of(result),
    afterOpened: () => of(undefined),
    backdropClick: () => EMPTY,
    keydownEvents: () => EMPTY,
    updateSize: jasmine.createSpy('updateSize'),
    updatePosition: jasmine.createSpy('updatePosition'),
    componentInstance: undefined as any,
    disableClose: false
  };
}

/**
 * A MatDialog double whose `open()` returns a ref that immediately closes with `result`.
 * Use `dialog.open.calls.mostRecent().args` to assert on what was opened and with what data.
 */
export function createMatDialogSpy<T = any>(result?: T) {
  const ref = createDialogRefSpy(result);
  const spy = jasmine.createSpyObj('MatDialog', ['open', 'closeAll']);
  spy.open.and.returnValue(ref);
  return Object.assign(spy, { ref });
}

/**
 * Asserts the contract every dialog *service* in this app implements: `openDialog(x)` opens
 * one specific component, hands `x` through as the dialog's `data`, and returns the ref.
 *
 * Those three things are the whole job of those services, and getting `data` wrong is the
 * failure that actually happens -- the dialog opens looking empty because it was handed the
 * wrong shape. Sharing the assertion keeps the six near-identical specs honest and short.
 */
export function expectDialogService<T>(
  dialog: ReturnType<typeof createMatDialogSpy>,
  returnedRef: unknown,
  expectedComponent: unknown,
  expectedData: T
): void {
  expect(dialog.open).toHaveBeenCalledTimes(1);
  const [component, config] = dialog.open.calls.mostRecent().args;
  expect(component).toBe(expectedComponent);
  expect(config.data).toEqual(expectedData);
  expect(returnedRef).toBe(dialog.ref);
}

/** A `SchemaClass` lookup double for the rare component that takes one directly. */
export function schemaClassByName(): (name: string) => SchemaClass {
  const byName = flattenSchemaTree(makeSchemaClassTree());
  return (name: string) => byName.get(name) ?? makeSchemaClass(name);
}

/** An `InstanceList` observable, for overriding `listInstances`/`searchInstances`. */
export function instanceListOf(instances: Instance[], totalCount?: number) {
  const list: InstanceList = { instances, totalCount: totalCount ?? instances.length };
  return of(list);
}
