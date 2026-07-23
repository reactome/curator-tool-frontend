import { Injectable } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { Instance, MatchResolution, NEW_DISPLAY_NAME } from "../models/reactome-instance.model";
import { DataService } from "./data.service";
import type { MatchResolutionService } from "./match-resolution.service";
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute, SchemaClass } from "../models/reactome-schema.model";
import { Subject, take, Observable, of, concatMap, map, from, tap, EMPTY, finalize } from "rxjs";
import { Store } from "@ngrx/store";
import { deleteInstances } from "src/app/instance/state/instance.selectors";
import { NewInstanceActions, UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { CommitWaitDialogComponent } from "src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component";
import { CommitResultDialogService, CommitResult } from "src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service";
import { MatchedInstancesDialogService } from "src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service";
import { MatchedNewInstanceGroup } from "src/app/shared/components/matched-instances-dialog/matched-instances-dialog.component";

/**
 * Group a set of utility methods here for easy access to all other classes.
 */
@Injectable({
    providedIn: 'root'
})
export class InstanceUtilities {
    // Track any instance click such as in table, list, etc.
    // The type if either string or number
    private lastClickedDbId = new Subject<string | number>();
    lastClickedDbId$ = this.lastClickedDbId.asObservable();

    // A shortcut to notify an instance view refresh
    // We use this method to make the code much, much simpler!
    private refreshViewDbId = new Subject<number>();
    refreshViewDbId$ = this.refreshViewDbId.asObservable();

    // Notify of display name update for bookmarks
    private refreshBookmarks = new Subject<number>();
    refreshBookmarks$ = this.refreshBookmarks.asObservable();

    // Call this when an instance is marked as deletion but not yet committed to
    // the database
    private markDeletionDbId = new Subject<number>();
    markDeletionDbId$ = this.markDeletionDbId.asObservable();

    // Call this when an instance deletion is committed to the database
    private deletedDbId = new Subject<number>();
    deletedDbId$ = this.deletedDbId.asObservable();

    // Track instances that have been marked for deletion and then reset (not committed)
    private resetDeletedDbId = new Subject<number>();
    resetDeletedDbId$ = this.resetDeletedDbId.asObservable();

    // The first is the old dbId and second newDbId
    private committedNewInstDbId = new Subject<[number, number]>();
    committedNewInstDbId$ = this.committedNewInstDbId.asObservable();

    // Bypass for comparison
    private lastClickedDbIdForComparison = new Subject<number>();
    lastClickedDbIdForComparison$ = this.lastClickedDbIdForComparison.asObservable();

    // reset instance 
    private resetInst = new Subject<{ modifiedAttributes: string[] | undefined, dbId: number }>();
    resetInst$ = this.resetInst.asObservable();

    private lastUpdatedInstance = new Subject<{ attribute: string, instance: Instance }>();
    lastUpdatedInstance$ = this.lastUpdatedInstance.asObservable();

    // Track the changed display names
    private dbId2displayName = new Map<number, string | undefined>();

    // Shell instances are managed here so that we can update their views (e.g. display name for updated instances
    // or dbId and display name for new instances after comitted)
    // Note: only shell instances referred are stored here
    private shellInstances = new Map<number, Instance>();

    // Track local-only new instances that were explicitly deleted (not committed).
    // This helps distinguish remove_new_instance caused by deletion vs commit transition.
    private permanentlyRemovedNewDbIds = new Set<number>();

    // Tracking the instances that are selected
    private listName2selectedInstances = new Map<string, Instance[]>();

    // Shared wait dialog used while committing new instances one by one
    private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;

    constructor(private store: Store,
        private dialog: MatDialog,
        private commitResultDialogService: CommitResultDialogService,
        private matchedInstancesDialogService: MatchedInstancesDialogService) {
    }

    /**
     * Track display name change for instance so that we can update display name in view.
     * @param instance 
     */
    registerDisplayNameChange(instance: Instance) {
        this.syncDisplayNameCache(instance);
        this.setRefreshViewDbId(instance.dbId);
    }

    /**
     * Synchronize display name cache and any existing shell instance display name.
     * Use this when receiving updates from other tabs before forcing a view refresh.
     */
    syncDisplayNameCache(instance: Instance) {
        this.dbId2displayName.set(instance.dbId, instance.displayName);
        const shell = this.shellInstances.get(instance.dbId);
        if (shell)
            shell.displayName = instance.displayName;
    }

    registerUpdatedInstance(attName: string, inst: Instance): void {
        let cloned: Instance = this.makeShell(inst);
        if (inst.dbId > 0) {
            // Have to make a clone to avoid any change to the current _instance!
            this.store.dispatch(UpdateInstanceActions.register_updated_instance(cloned));
        } else {
            // Force the state to update if needed
            this.store.dispatch(NewInstanceActions.register_new_instance(cloned));
        }
        this.store.dispatch(UpdateInstanceActions.last_updated_instance({ attribute: attName, instance: cloned }));
    }

    setLastUpdatedInstance(attribute: string, instance: Instance) {
        this.lastUpdatedInstance.next({
            attribute: attribute,
            instance: instance
        });
    }

    setCommittedNewInstDbId(oldDbId: number, newDbId: number) {
        this.permanentlyRemovedNewDbIds.delete(oldDbId);
        this.updateNewInstanceRegistration(oldDbId, newDbId);
        this.committedNewInstDbId.next([oldDbId, newDbId]);
    }

    private updateNewInstanceRegistration(oldDbId: number, newDbId: number) {
        let shell = this.shellInstances.get(oldDbId);
        if (shell) {
            shell.dbId = newDbId;
            this.shellInstances.delete(oldDbId);
            this.shellInstances.set(newDbId, shell);
        }
    }

    setDeletedDbId(dbId: number) {
        if (dbId < 0)
            this.permanentlyRemovedNewDbIds.add(dbId);
        this.deletedDbId.next(dbId);
    }
    setResetDeletedDbId(dbId: number) {
        if (dbId < 0)
            this.permanentlyRemovedNewDbIds.delete(dbId);
        this.resetDeletedDbId.next(dbId);
    }

    isPermanentlyRemovedNewInstance(dbId: number): boolean {
        return dbId < 0 && this.permanentlyRemovedNewDbIds.has(dbId);
    }

    setMarkDeletionDbId(dbId: number) {
        this.markDeletionDbId.next(dbId);
    }

    setResetInstance(modifiedAtts: string[] | undefined, inst: Instance) {
        // Call this first in case the name is needed
        this.syncDisplayNameCache(inst);
        this.resetInst.next({ modifiedAttributes: modifiedAtts, dbId: inst.dbId });
    }

    setRefreshViewDbId(dbId: number) {
        this.refreshViewDbId.next(dbId);
    }

    setLastClickedDbId(dbId: string | number) {
        this.lastClickedDbId.next(dbId);
    }

    setLastClickedDbIdForComparison(dbId: number) {
        this.lastClickedDbIdForComparison.next(dbId);
    }


    /**
     * Add helpers (catalyst, activator, and inhibitor) to the passed reaction instance
     * so that they can be rendered in the pathway diagram.
     * @param reaction 
     * @param helpers 
     */
    addHelpersToReaction(reaction: Instance, helpers: Instance[]) {
        for (let helper of helpers) {
            if (helper.schemaClassName === 'CatalystActivity') {
                const catalyst = helper.attributes.get('physicalEntity');
                const catalystArray = reaction.attributes.get('catalyst') ?? [];
                catalystArray.push(catalyst);
                reaction.attributes.set('catalyst', catalystArray);
            }
            else if (helper.schemaClassName.includes('Negative')) { // A simple way to check the class
                const inhibitor = helper.attributes.get('regulator');
                const inhibitorArray = reaction.attributes.get('inhibitor') ?? [];
                inhibitorArray.push(inhibitor);
                reaction.attributes.set('inhibitor', inhibitorArray);
            }
            else if (helper.schemaClassName.includes('Positive') || helper.schemaClassName === 'Requirement') {
                const activator = helper.attributes.get('regulator');
                const activatorArray = reaction.attributes.get('activator') ?? [];
                activatorArray.push(activator);
                reaction.attributes.set('activator', activatorArray);
            }
        }
    }

    grepReactomeParticipantIds(reaction: Instance): number[] {
        let dbIds = new Set<number>();
        const participantAtts = ['input', 'output', 'catalyst', 'activator', 'inhibitor'];
        for (let att of participantAtts) {
            const attValue = reaction.attributes.get(att);
            if (!attValue) continue;
            attValue.forEach((element: any) => { dbIds.add(element.dbId) });
        }
        return Array.from(dbIds);
    }

    private grepReactomeParticipants(reaction: Instance): Instance[] {
        let particiapnts = new Set<Instance>();
        const participantAtts = ['input', 'output', 'catalyst', 'activator', 'inhibitor'];
        for (let att of participantAtts) {
            const attValue = reaction.attributes.get(att);
            if (!attValue) continue;
            attValue.forEach((element: any) => { particiapnts.add(element) });
        }
        return Array.from(particiapnts);
    }

    fillRenderInfoForReactionParticipants(reaction: Instance, instances: Instance[], dataService: DataService): Observable<void> {
        // Generate a map for easy setting
        // the value in this map is fully loaded instance with all attributes.
        let id2inst = new Map<number, Instance>();
        instances.forEach(participant => {
            id2inst.set(participant.dbId, participant);
        });
        const participants = this.grepReactomeParticipants(reaction);
        participants.forEach(participant => {
            const loadedInst = id2inst.get(participant.dbId);
            if (loadedInst) {
                if (!participant.attributes) participant.attributes = new Map<string, any>();
                const refClsName = loadedInst.attributes?.get('referenceEntity')?.schemaClassName ?? 'ReferenceEntity';
                participant.attributes.set('refSchemaClass', refClsName);
                participant.attributes.set('hasModifiedResidue', loadedInst.attributes?.get('hasModifiedResidue'));
            }
        });

        // Step 1: Collect all hasModifiedResidue dbIds
        const modifiedResidueDbIds = new Set<number>();
        participants.forEach(participant => {
            const modifiedResidues = participant.attributes?.get('hasModifiedResidue');
            if (modifiedResidues && Array.isArray(modifiedResidues)) {
                modifiedResidues.forEach((residue: any) => {
                    if (residue && residue.dbId) {
                        modifiedResidueDbIds.add(residue.dbId);
                    }
                });
            } else if (modifiedResidues && modifiedResidues.dbId) {
                modifiedResidueDbIds.add(modifiedResidues.dbId);
            }
        });

        // If no modified residues, return immediately
        if (modifiedResidueDbIds.size === 0) {
            return of(undefined);
        }

        // Step 2: Fetch all hasModifiedResidue instances fully
        return dataService.fetchInstances(Array.from(modifiedResidueDbIds)).pipe(
            concatMap((modifiedResidueInstances: Instance[]) => {
                // Update participants with fully loaded ModifiedResidue instances
                const modResidueMap = new Map<number, Instance>();
                modifiedResidueInstances.forEach(modRes => {
                    modResidueMap.set(modRes.dbId, modRes);
                });

                participants.forEach(participant => {
                    const modifiedResidues = participant.attributes?.get('hasModifiedResidue');
                    if (modifiedResidues && Array.isArray(modifiedResidues)) {
                        const fullyLoadedResidues = modifiedResidues.map((residue: any) => {
                            if (residue && residue.dbId) {
                                return modResidueMap.get(residue.dbId) || residue;
                            }
                            return residue;
                        });
                        participant.attributes?.set('hasModifiedResidue', fullyLoadedResidues);
                    } else if (modifiedResidues && modifiedResidues.dbId) {
                        const fullyLoaded = modResidueMap.get(modifiedResidues.dbId);
                        if (fullyLoaded) {
                            participant.attributes?.set('hasModifiedResidue', fullyLoaded);
                        }
                    }
                });

                // Step 3: Collect all psiMod dbIds from ModifiedResidue instances
                const psiModDbIds = new Set<number>();
                modifiedResidueInstances.forEach(modRes => {
                    const psiMod = modRes.attributes?.get('psiMod');
                    if (psiMod && psiMod.dbId) {
                        psiModDbIds.add(psiMod.dbId);
                    }
                });

                // If no psiMod references, return
                if (psiModDbIds.size === 0) {
                    return of(undefined);
                }

                // Step 4: Fetch all psiMod instances fully
                return dataService.fetchInstances(Array.from(psiModDbIds)).pipe(
                    map((psiModInstances: Instance[]) => {
                        // Update ModifiedResidue instances with fully loaded psiMod
                        const psiModMap = new Map<number, Instance>();
                        psiModInstances.forEach(psiMod => {
                            psiModMap.set(psiMod.dbId, psiMod);
                        });

                        modifiedResidueInstances.forEach(modRes => {
                            const psiMod = modRes.attributes?.get('psiMod');
                            if (psiMod && psiMod.dbId) {
                                const fullyLoadedPsiMod = psiModMap.get(psiMod.dbId);
                                if (fullyLoadedPsiMod) {
                                    modRes.attributes?.set('psiMod', fullyLoadedPsiMod);
                                }
                            }
                        });

                        return undefined;
                    })
                );
            })
        );
    }

    _isSchemaClass(className: string, schemaClass: SchemaClass | undefined): boolean {
        if (schemaClass === undefined)
            return false;
        // Get all children
        let allClsNames = new Set<string>();
        let current = new Set<SchemaClass>();
        let next = new Set<SchemaClass>()
        current.add(schemaClass);
        while (current.size > 0) {
            for (let cls of current) {
                allClsNames.add(cls.name);
                if (cls.children) {
                    for (let child of cls.children) {
                        if (allClsNames.has(child.name))
                            continue;
                        next.add(child);
                    }
                }
            }
            // Let's just do a switch
            current = new Set(next);
            next.clear();
        }
        return allClsNames.has(className);
    }

    isDescendantSchemaClass(className: SchemaClass, parentClass: SchemaClass | undefined): boolean {
        return this._isSchemaClass(className.name, parentClass);
    }

    isSchemaClass(instance: Instance, className: string, dataService: DataService): boolean {
        let schemaClass = dataService.getSchemaClass(className);
        return this._isSchemaClass(instance.schemaClassName, schemaClass);
    }

    /**
     * A utility function to parse by "." and return the last string as the
     * schemaClass name from a Java class name.
     */
    private getClassName(javaClsName: string) {
        if (!javaClsName) return '';
        let lastIndex = javaClsName.lastIndexOf('.');
        return javaClsName.substring(lastIndex + 1);
    }

    /**
     * Collect allowed classes from attributeClasses
     * @param attributeClasses
     */
    getAllowedClasses(attributeClasses: any): string[] {
        let allowedClses: string[] = [];
        for (let element of attributeClasses) {
            let type = element.type;
            if (type.startsWith('org.reactome')) {
                let clsName = this.getClassName(type);
                allowedClses.push(clsName);
            }
        }
        return allowedClses;
    }

    /**
     * A helper function to convert a JSON array into a SchemaClass so that it is easier to model.
     * @param data
     */
    convertToSchemaClass(clsName: string, data: any): SchemaClass {
        let attributes: SchemaAttribute[] = [];
        for (let element of data) {
            let properties = element.properties;
            // Something not right with deletedInstanceDB_ID: no proprties.
            // Need to check why. Escape for the time being
            if (properties === undefined) continue;
            let categoryKey: keyof typeof AttributeCategory = element.category;
            let definingTypeKey: keyof typeof AttributeDefiningType = element.definingType;
            let allowedClasses = this.getAllowedClasses(properties.attributeClasses);
            let attribute: SchemaAttribute = {
                name: properties.name,
                cardinality: properties.cardinality,
                type: this.convertToAttType(properties),
                category: AttributeCategory[categoryKey], // The second element
                definingType: AttributeDefiningType[definingTypeKey], // Second element
                origin: this.getClassName(properties.origin),
            };
            if (allowedClasses.length > 0) {
                attribute.allowedClases = allowedClasses;
            }
            attributes.push(attribute);
        }
        let SchemaClass: SchemaClass = {
            name: clsName,
            attributes: attributes,
        };
        return SchemaClass;
    }

    /**
     * Convert a Java class type into the attribute type (e.g. instance, integer, etc).
     * @param properties
     * @returns
     */
    private convertToAttType(properties: any): AttributeDataType {
        // We need to determine if this is an instance type or other plain
        // Java type. Therefore, the first class should suffice.
        let type = properties.attributeClasses[0].type;
        if (type.startsWith("org.reactome"))
            return AttributeDataType.INSTANCE;
        if (type.endsWith("Long") || type.endsWith("Integer"))
            return AttributeDataType.INTEGER;
        if (type.endsWith("Float") || type.endsWith("Double"))
            return AttributeDataType.FLOAT;
        if (type.endsWith("Boolean"))
            return AttributeDataType.BOOLEAN;
        return AttributeDataType.STRING; // Default
    }

    copyData(data: any): any {
        // Filter out undefined values from the edge data
        const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined));
        // Stringify the filtered data
        const jsonString = JSON.stringify(filteredData);
        const dataCopy = JSON.parse(jsonString);
        return dataCopy;
    }

    cloneInstance(instance: Instance): Instance {
        return JSON.parse(JSON.stringify(instance));
    }

    /**
       * Attributes returned from the server are kept as JavaScript object since JavaScript really
       * doesn't care about the type. Therefore, we need to do some converting here.
       * @param instance
       */
    handleInstanceAttributes(instance: Instance): void {
        if (instance.attributes === undefined)
            return;
        let attributeMap = new Map<string, any>();
        let attributes: any = instance.attributes;
        Object.keys(attributes).map((key: string) => {
            const value = attributes[key];
            // make sure cached shell instances are used here
            if (Array.isArray(value)) {
                let arrayValue = [];
                for (let element of value) {
                    if (this.isInstance(element)) {
                        arrayValue.push(this.getShellInstance(element));
                    }
                    else
                        arrayValue.push(element);
                }
                attributeMap.set(key, arrayValue);
            }
            else if (this.isInstance(value)) {
                attributeMap.set(key, this.getShellInstance(value));
            }
            else
                attributeMap.set(key, value);
        });
        instance.attributes = attributeMap;
    }

    stringifyInstance(instance: Instance): string {
        return JSON.stringify({
            ...instance,
            schemaClass: undefined, // No need to push the schemaClass around
            attributes: instance.attributes ? Object.fromEntries(instance.attributes) : undefined
        });
    }

    stringifyInstances(instances: Instance[]): string {
        return JSON.stringify(instances.map(inst => ({
            ...inst,
            schemaClass: undefined,
            attributes: inst.attributes ? Object.fromEntries(inst.attributes) : undefined
        })));
    }

    makeShell(inst: Instance) {
        return {
            dbId: inst.dbId,
            schemaClassName: inst.schemaClassName,
            displayName: this.dbId2displayName.get(inst.dbId) ?? inst.displayName
        };
    }

    /**
     * Get the cached shell instance for the passed instance. If not cached, create one and cache it.
     * @param inst 
     * @returns 
     */
    getShellInstance(inst: Instance) {
        let shell = this.shellInstances.get(inst.dbId);
        if (!shell) {
            shell = this.makeShell(inst);
            this.shellInstances.set(inst.dbId, shell);
        } else if (!this.dbId2displayName.has(inst.dbId) && inst.displayName && inst.displayName !== shell.displayName) {
            this.registerDisplayNameChange(inst);
        }
        return shell;
    }

    /**
     * Copy the attributes shared between a ReferenceGeneProduct (or, historically,
     * a ReferencePeptideSequence) and an EntityWithAccessionedSequence into the passed
     * EWAS. This is a TypeScript port of
     * InstanceUtilities.copyAttributesFromRefPepSeqToEwas in the Java Curator Tool.
     *
     * The EWAS is expected to already have its schemaClass populated (e.g. created via
     * DataService.createNewInstance) so that attribute cardinalities can be honored.
     * @param ewas the EntityWithAccessionedSequence to fill in
     * @param refGeneProduct the source ReferenceGeneProduct (fully loaded attributes)
     */
    copyAttributesFromRefGeneProductToEwas(ewas: Instance, refGeneProduct: Instance): void {
        if (!ewas.attributes)
            ewas.attributes = new Map();
        const source: Map<string, any> = refGeneProduct.attributes;

        // Helper to set a value honoring the EWAS attribute's cardinality.
        const setValue = (attributeName: string, value: any) => {
            const attribute = ewas.schemaClass?.attributes?.find(a => a.name === attributeName);
            if (!attribute)
                return; // Not a valid EWAS attribute; skip defensively
            if (attribute.cardinality === '1')
                ewas.attributes.set(attributeName, Array.isArray(value) ? value[0] : value);
            else
                ewas.attributes.set(attributeName, Array.isArray(value) ? value : [value]);
        };

        // The EWAS points back to the ReferenceGeneProduct via referenceEntity.
        setValue('referenceEntity', this.getShellInstance(refGeneProduct));

        // Copy species. On a ReferenceSequence this is single-valued.
        let species = source?.get('species');
        if (Array.isArray(species))
            species = species[0];
        if (species)
            setValue('species', this.getShellInstance(species));

        // Build up the list of names from geneName, description, name and secondaryIdentifier.
        const ewasNames: string[] = [];

        // The first gene name
        const geneNames: string[] = source?.get('geneName');
        if (geneNames && geneNames.length > 0)
            ewasNames.push(geneNames[0]);

        // Name from the description: the text before "(", handling the UniProt
        // shortName/alternativeName/recommendedName formats.
        const rawDescription = source?.get('description');
        let description: string | undefined;
        if (Array.isArray(rawDescription))
            description = rawDescription.find(value => typeof value === 'string' && value.trim().length > 0);
        else if (typeof rawDescription === 'string')
            description = rawDescription;
        if (description) {
            description = description.trim();
            let index = description.indexOf('(');
            if (index > 0)
                description = description.substring(0, index).trim();
            // Check if the new (03/15/09) format is used
            let index1 = description.indexOf('shortName');
            let index2 = description.indexOf('alternativeName');
            if (index1 > 0 || index2 > 0) {
                if (index1 < 0)
                    index1 = description.length;
                if (index2 < 0)
                    index2 = description.length;
                index = Math.min(index1, index2);
                description = description.substring(0, index).trim();
            }
            // Sometimes description starts with "recommendedName"
            if (description.startsWith('recommendedName'))
                description = description.substring('recommendedName'.length + 1).trim(); // Remove: recommendedName:
            if (description.length > 0 && !ewasNames.includes(description))
                ewasNames.push(description);
        }

        // The first name
        const names: string[] = source?.get('name');
        if (names && names.length > 0) {
            const name = names[0];
            if (!ewasNames.includes(name))
                ewasNames.push(name);
        }

        // UniProt id from secondaryIdentifier (e.g. something ending in _HUMAN)
        const ids: string[] = source?.get('secondaryIdentifier');
        if (ids && ids.length > 0) {
            const pattern = /_[A-Z]+$/; // Java: _(\p{Upper})+$
            for (const id of ids) {
                if (pattern.test(id)) {
                    if (!ewasNames.includes(id))
                        ewasNames.push(id);
                    break;
                }
            }
        }

        setValue('name', ewasNames);

        // Set the start/end coordinates of the EWAS by parsing the ReferenceGeneProduct's
        // "chain" attribute locally, instead of downloading the UniProt flat file and reading
        // its "FT   CHAIN" line (the original Java fetchCoordinates approach). The chain values
        // are stored in the Reactome model as "<featureType>:<start>-<end>" strings; mirroring
        // the Java logic, we use the first "chain"-typed entry and take its first two integers.
        // Fall back to a default start of 1 and end of -1 when no chain coordinates are available.
        const coordinates = this.parseCoordinatesFromChain(source?.get('chain')) ?? [1, -1];
        setValue('startCoordinate', coordinates[0]);
        setValue('endCoordinate', coordinates[1]);
    }

    /**
     * Parse the start and end coordinates from a ReferenceGeneProduct's "chain" attribute.
     *
     * This is the local equivalent of the Java CuratorTool's fetchCoordinates(String), which
     * downloaded the UniProt flat file and read the first "FT   CHAIN" line, taking the first
     * two integers on that line as the start and end. Here the same information is already
     * available on the ReferenceGeneProduct's "chain" attribute (a list of
     * "<featureType>:<start>-<end>" strings), so no network request is needed.
     *
     * @param chain the raw value of the "chain" attribute (array of strings, a single string, or undefined)
     * @returns a [start, end] tuple, or null if no "chain:"-prefixed entry with two coordinates was found
     */
    private parseCoordinatesFromChain(chain: any): [number, number] | null {
        if (!chain)
            return null;
        const entries: string[] = (Array.isArray(chain) ? chain : [chain])
            .filter(v => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.trim());

        // Use the first entry beginning with "chain:" (mirroring the Java "FT   CHAIN" filter),
        // and take its first two integers as the start and end coordinates.
        const chainEntry = entries.find(entry => entry.toLowerCase().startsWith('chain:'));
        if (!chainEntry)
            return null;
        const nums = (chainEntry.match(/\d+/g) ?? []).map(n => parseInt(n, 10));
        if (nums.length < 2)
            return null;
        return [nums[0], nums[1]];
    }

    private getDynamicAttributeValue(instance: any, attributeName: string): any {
        if (!instance || !instance.attributes)
            return undefined;
        if (instance.attributes instanceof Map)
            return instance.attributes.get(attributeName);
        return instance.attributes[attributeName];
    }

    /**
     * Build commit summary rows for the dialog by including the directly committed instance and
     * any additional committed instances returned by the server.
     *
     * Supports both legacy mapping (newInstOld2NewId) and per-instance newInstOldId markers.
     */
    buildCommitSummaryResults(committedInst: Instance, rtnInst: Instance): { displayName: string, dbId: number }[] {
        const results: { displayName: string, dbId: number }[] = [];
        const seenDbIds = new Set<number>();

        const addResult = (dbId: number | undefined, displayName?: string) => {
            if (dbId === undefined || dbId === null)
                return;
            if (seenDbIds.has(dbId))
                return;
            seenDbIds.add(dbId);
            results.push({
                dbId,
                displayName: displayName ?? NEW_DISPLAY_NAME
            });
        };

        // The passed instance can be a stale shell whose displayName is still the
        // "To be generated" placeholder (e.g. a selection captured before the name
        // was generated). In that case fall back to the authoritative display-name
        // cache — the same source makeShell and the list views use — so the commit
        // summary matches what the user sees in the list.
        const resolveDisplayName = (inst: Instance): string | undefined => {
            if (inst.displayName && inst.displayName !== NEW_DISPLAY_NAME)
                return inst.displayName;
            return this.dbId2displayName.get(inst.dbId) ?? inst.displayName;
        };

        const committedName = resolveDisplayName(committedInst) ?? rtnInst.displayName;
        addResult(rtnInst.dbId, committedName);

        // Legacy payload support: map old local ids to newly persisted ids.
        if (rtnInst.newInstOld2NewId) {
            const old2newId: any = rtnInst.newInstOld2NewId;
            Object.keys(old2newId).forEach((oldId) => {
                const oldDbId = parseInt(oldId, 10);
                const newDbId = old2newId[oldId];
                const oldShell = this.shellInstances.get(oldDbId);
                addResult(newDbId, oldShell?.displayName);
            });
        }

        const rtnOldId = (rtnInst as any).newInstOldId ?? this.getDynamicAttributeValue(rtnInst, 'newInstOldId');
        if (rtnOldId !== undefined && rtnOldId !== null) {
            const oldShell = this.shellInstances.get(Number(rtnOldId));
            addResult(rtnInst.dbId, rtnInst.displayName ?? oldShell?.displayName);
        }

        const returnedCommittedInstances = this.getDynamicAttributeValue(rtnInst, 'committedInstances');
        if (Array.isArray(returnedCommittedInstances)) {
            returnedCommittedInstances.forEach((returnedInst: any) => {
                if (!returnedInst || returnedInst.dbId === undefined || returnedInst.dbId === null)
                    return;
                const oldId = returnedInst.newInstOldId ?? this.getDynamicAttributeValue(returnedInst, 'newInstOldId');
                const oldShell = oldId !== undefined && oldId !== null ? this.shellInstances.get(Number(oldId)) : undefined;
                addResult(returnedInst.dbId, returnedInst.displayName ?? oldShell?.displayName);
            });
        }

        return results;
    }

    removeInstInArray(target: Instance, array: Instance[]) {
        if (!array) return;
        const index = array.findIndex(obj => obj.dbId === target.dbId);
        if (index >= 0)
            array.splice(index, 1);
    }

    applyLocalDeletions(inst: Instance, deletedInsts: Instance[], apply: boolean = true, asPassiveEdit: boolean = true): boolean {
        if (!deletedInsts || deletedInsts.length === 0 || !inst.attributes)
            return false;
        const dbIds = deletedInsts.map(inst => inst.dbId);
        let modified = false;
        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue)
                continue;
            if (Array.isArray(attValue)) {
                for (let i = 0; i < attValue.length; i++) {
                    const attValue1 = attValue[i];
                    if (!this.isInstance(attValue1))
                        break; // This is not a instance type attribute

                    if (dbIds.includes(attValue1.dbId)) {
                        if (!apply) return true;
                        // Ensure a value is defined for this attribute
                        if (attValue.length === 1) {
                            attValue[0] = undefined;
                            inst.attributes.delete(att);
                        }
                        else {
                            attValue.splice(i, 1);
                            i--;
                        }
                        if (asPassiveEdit)
                            this.addToPassiveModifiedAttributes(att, inst);
                        else {
                            this.addToModifiedAttributes(att, inst);
                            if (inst.passiveModifiedAttributes)
                                inst.passiveModifiedAttributes = inst.passiveModifiedAttributes.filter(a => a !== att);
                        }
                        modified = true;
                    }
                }
            }
            // We cannot use instanceof to check if attValue is an Instance
            // But we can check if it has dbId
            else if (attValue.dbId) {
                if (dbIds.includes(attValue.dbId)) {
                    if (!apply) return true;
                    // Remove this attribute since nothing is there
                    // inst?.attributes?.set(
                    //     att.attribute?.name,
                    //     undefined
                    inst.attributes.delete(att);

                    if (asPassiveEdit)
                        this.addToPassiveModifiedAttributes(att, inst);
                    else {
                        this.addToModifiedAttributes(att, inst);
                        if (inst.passiveModifiedAttributes)
                            inst.passiveModifiedAttributes = inst.passiveModifiedAttributes.filter(a => a !== att);
                    }
                    modified = true;
                }
            }
        }
        return modified;
    }

    /**
     * Check if the first instance, of which dbId is passed, is a reference of the second instance.
     * @param referrer 
     * @param inst 
     */
    isReferrer(referenceDbId: number, inst: Instance) {
        if (!inst.attributes)
            return false;
        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue)
                continue;
            if (Array.isArray(attValue)) {
                for (let i = 0; i < attValue.length; i++) {
                    const attValue1 = attValue[i];
                    if (referenceDbId === attValue1.dbId)
                        return true;
                }
            }
            else if (referenceDbId === attValue.dbId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Remove an instance from the reference list of the passed instance.
     * The reference is specified by the referenceDbId.
     * @param inst 
     * @param referenceDbId 
     */
    removeReference(inst: Instance, referenceDbId: number) {
        if (!inst.attributes) return;

        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue) continue;

            if (Array.isArray(attValue)) {
                // Iterate in reverse to avoid skipping elements when splicing
                for (let i = attValue.length - 1; i >= 0; i--) {
                    const attValue1 = attValue[i];
                    if (referenceDbId === attValue1.dbId) {
                        attValue.splice(i, 1);
                    }
                }
                if (attValue.length === 0) inst.attributes.delete(att);
            }
            else if (referenceDbId === attValue.dbId) {
                inst.attributes.delete(att);
            }
        }
    }

    addToPassiveModifiedAttributes(att: string, inst: Instance | undefined) {
        if (!inst) return;
        if (!inst.passiveModifiedAttributes)
            inst.passiveModifiedAttributes = [];
        if (!inst.passiveModifiedAttributes.includes(att)) {
            // Create a new array to avoid modifying a frozen/non-extensible array
            inst.passiveModifiedAttributes = [...inst.passiveModifiedAttributes, att];
        }
    }

    addToModifiedAttributes(att: string, inst: Instance | undefined) {
        if (!inst) return;
        if (!inst.modifiedAttributes)
            inst.modifiedAttributes = [];
        if (!inst.modifiedAttributes.includes(att)) {
            // Create a new array to avoid modifying a frozen/non-extensible array
            inst.modifiedAttributes = [...inst.modifiedAttributes, att];
        }
    }

    removeModifiedAttribute(attributeName: string, instance: Instance | undefined) {
        if (!instance ||
            !instance.modifiedAttributes ||
            instance.modifiedAttributes.length === 0
        ) return; // Do nothing if there is no modified attributes
        let index = instance.modifiedAttributes.indexOf(attributeName);
        if (index > -1)
            instance.modifiedAttributes!.splice(index, 1);
    }

    mergeLocalChangesToEventTree(rootEvent: Instance, id2instance: Map<number, Instance>) {
        // For quick search 
        const id2event = new Map<number, Instance>();
        this.grepId2Event(rootEvent, id2event);
        // Event deletion may impact the tree structure
        // therefore, we need to check it too
        this.store.select(deleteInstances()).pipe(take(1)).subscribe(insts => {
            const deletedDbIds = insts ? insts.map(i => i.dbId) : [];
            this._mergeLocalChangesToEventTree(rootEvent, id2event, deletedDbIds, id2instance);
        });
    }

    // TODO: ask Guanming about merging passive edits to the event tree
    private _mergeLocalChangesToEventTree(event: Instance,
        id2event: Map<number, Instance>,
        deletedDbIds: number[],
        id2instance: Map<number, Instance>) {
        const local = id2instance.get(event.dbId);
        if (local) {
            if (local.dbId < 0) {
                // This is a new instance
                this.replaceHasEvent(local, event, id2event);
            }
            else if (local.modifiedAttributes && local.modifiedAttributes.length > 0) {
                for (let modifiedAtt of local.modifiedAttributes) {
                    // These attributes are related to the event tree
                    if (modifiedAtt === 'name')
                        event.displayName = local.displayName; // Display name may change
                    else if (modifiedAtt === 'hasDiagram' || modifiedAtt === '_doRelease' || modifiedAtt === 'speciesName')
                        event.attributes[modifiedAtt] = local.attributes.get(modifiedAtt);
                    else if (modifiedAtt === 'hasEvent') {
                        // This is much more complicated. Here, we just replace the whole hasEvent list
                        // This is similar to handleHasEventEdit in EventTreeComponent
                        this.replaceHasEvent(local, event, id2event);
                    }
                }
            }
        }
        // Recursive calling
        if (event.attributes?.hasEvent) {
            for (let i = 0; i < event.attributes.hasEvent.length; i++) {
                let child = event.attributes.hasEvent[i];
                if (deletedDbIds.includes(child.dbId)) {
                    event.attributes.hasEvent.splice(i, 1);
                    i--; // This is important: need to adjust the index after removal to check the next one 
                }
                else {
                    // Recursively process the child
                    this._mergeLocalChangesToEventTree(child, id2event, deletedDbIds, id2instance);
                }
            }
        }
    }

    private replaceHasEvent(localEvent: Instance, dbEvent: Instance, id2event: Map<number, Instance>) {
        const newHasEvent = [];
        if (localEvent.attributes.get('hasEvent')) {
            for (let tmpInst of localEvent.attributes.get('hasEvent')) {
                let childEvent = id2event.get(tmpInst.dbId);
                if (childEvent)
                    newHasEvent.push(childEvent);
                else {
                    // This is a new instance
                    // Make a copy
                    // The new instance's hasEvent points to shell instances
                    // that are not in the event tree. However, calling this function
                    // _mergeLocalChanesToEventTree recursively will fix this issue.
                    // since hasEvent will
                    const newEvent = {
                        ...tmpInst,
                        attributes: { 'hasEvent': tmpInst.attributes?.get('hasEvent') }
                    };
                    newHasEvent.push(newEvent);
                }
            }
        }
        dbEvent.attributes['hasEvent'] = newHasEvent;
    }

    private grepId2Event(event: Instance, id2event: Map<number, Instance>) {
        id2event.set(event.dbId, event);
        if (event.attributes?.hasEvent) {
            for (let child of event.attributes.hasEvent) {
                this.grepId2Event(child, id2event);
            }
        }
    }

    cloneInstanceForCommit(source: Instance): Instance {
        let instance: Instance = {
            dbId: source.dbId,
            displayName: source.displayName,
            schemaClassName: source.schemaClassName,
        }
        if (source.isStructureModified)
            instance.isStructureModified = source.isStructureModified;
        if (source.modifiedAttributes && source.modifiedAttributes.length)
            instance.modifiedAttributes = [...source.modifiedAttributes]
        // Should not need to consider passiveModifiedAttributes here as they will be applied via other commits to the database.
        // Need to manually convert the instance to a string because the use of map for attributes
        if (source.attributes && source.attributes.size > 0) {
            // Need to recursively clone the attributes before assigning
            // This should be a depth-first cloning
            instance.attributes = new Map<string, any>();
            source.attributes.forEach((value: any, key: string) => {
                if (Array.isArray(value)) {
                    let arrayValue = [];
                    for (let element of value) {
                        if (this.isInstance(element)) {
                            arrayValue.push(this.cloneInstanceForCommit(element));
                        }
                        else
                            arrayValue.push(element);
                    }
                    instance.attributes.set(key, arrayValue);
                }
                else if (this.isInstance(value)) {
                    instance.attributes.set(key, this.cloneInstanceForCommit(value));
                }
                else
                    instance.attributes.set(key, value);
            });
            let attributesJson = Object.fromEntries(instance.attributes);
            instance.attributes = attributesJson;
        }
        return instance;
    }

    isInstance(value: any): boolean {
        if (typeof value === 'object' && 'dbId' in value)
            return true;
        return false;
    }

    isChanged(instance: Instance): boolean {
        if (instance.dbId < 0)
            return false; // New instance
        if ((instance.modifiedAttributes && instance.modifiedAttributes.length > 0) ||
            (instance.passiveModifiedAttributes && instance.passiveModifiedAttributes.length > 0))
            return true;
        return false;
    }

    /**
     * Handle post processing after committing an instance to the database.
     * @param instance 
     */
    processCommit(committedInst: Instance, rtnInst: Instance, dataService: DataService) {
        if (committedInst.dbId >= 0) { // This is an updated instance
            this.store.dispatch(UpdateInstanceActions.remove_updated_instance(committedInst));
            // Signal the detail/list views to re-fetch the freshly committed instance
            // from the backend. Without this, commit() removes the instance from the
            // cache and discards the returned copy, leaving the UI showing stale data.
            this.setRefreshViewDbId(committedInst.dbId);
        }
        else if (committedInst.dbId < 0) { // This is a new instance
            // Make sure the remove_new_instance should be called first. The second dispatch will update the dbId in the store. 
            this.store.dispatch(NewInstanceActions.remove_new_instance(committedInst));
            this.store.dispatch(NewInstanceActions.commit_new_instance({
                oldDbId: committedInst.dbId,
                newDbId: rtnInst.dbId
            }));
            dataService.flagSchemaTreeForReload()
        }
        // Make sure new instances are updated if any
        // The following code is applied to shell instances that may be referred. This action
        // is needed and is different from the above committedInst. 
        if (rtnInst.newInstOld2NewId) {
            // Have to use this temp variable to avoid type error
            let old2newId: any = rtnInst.newInstOld2NewId!;
            Object.keys(old2newId).map((oldId) => {
                const oldDbId: number = parseInt(oldId, 10);
                const newDbId: number = old2newId[oldId];
                const shell = this.shellInstances.get(oldDbId);
                if (shell) {
                    this.store.dispatch(NewInstanceActions.remove_new_instance(shell));
                    this.store.dispatch(NewInstanceActions.commit_new_instance({
                        oldDbId: oldDbId,
                        newDbId: newDbId
                    }));
                    // check that the store has updated the dbId, otherwise update it here so that the shell instances are synchronized
                    if (shell.dbId !== newDbId) {
                        this.updateNewInstanceRegistration(oldDbId, newDbId);
                        this.setRefreshViewDbId(committedInst.dbId);
                    }
                }
            });
        }
        if (rtnInst.stableIdentifierModified) {
            dataService.fetchInstance(committedInst.dbId).subscribe(fullInst => {
                if(!fullInst.attributes) return;
                let stableIdentifierDbId = fullInst.attributes.get('stableIdentifier')?.dbId;
                const shell = this.shellInstances.get(stableIdentifierDbId);
                if (shell) {
                    this.store.dispatch(UpdateInstanceActions.ls_register_updated_instance(shell));
                    this.store.dispatch(UpdateInstanceActions.remove_updated_instance(shell));
                }

                this.setRefreshViewDbId(stableIdentifierDbId);
                this.registerDisplayNameChange(stableIdentifierDbId);;
            })
        }
    }

    /**
     * Commit a list of new instances to the database sequentially (one by one).
     *
     * Each instance is first checked for existing database matches. Any instance
     * that matches is deferred and collected; once the initial pass finishes the
     * user is shown the matched-instances dialog and may choose to commit the
     * matched instances anyway. Instances without matches are committed
     * immediately. A wait dialog is shown throughout, and a commit-result dialog
     * is opened at the end summarizing what was persisted.
     *
     * Sequential commits (concatMap) are required because each commit mutates
     * shared state (the id2instance cache and the NgRx store dbId remapping in
     * processCommit); concurrent commits would race and desync the store.
     *
     * Shared by the schema list view (InstanceListViewComponent) and the local
     * instance list (UpdatedInstanceListComponent).
     *
     * @param instances the new instances to commit
     * @param dataService the data service used for the match/commit REST calls
     * @param onComplete invoked once the initial commit pass completes, before any
     *                   result/match dialogs open. Use it to clear selection state.
     */
    commitNewInstances(instances: Instance[], dataService: DataService, matchResolutionService: MatchResolutionService, onComplete?: () => void) {
        if (!instances || instances.length === 0)
            return;

        this.openCommitWaitDialog(
            'Committing New Instances',
            'Please wait while selected new instances are committed one by one.'
        );

        const results: CommitResult[] = [];
        const matchedGroups: MatchedNewInstanceGroup[] = [];

        from(instances).pipe(
            concatMap(inst => {
                if (inst.dbId && inst.dbId > 0) {
                    return EMPTY;
                }
                const commit$ = dataService.commit(inst).pipe(
                    tap(rtn => this.processCommit(inst, rtn, dataService)),
                    map(rtn => this.buildCommitSummaryResults(inst, rtn))
                );
                // Run the pre-commit duplication check for new instances (see shouldCheckForMatches).
                if (!dataService.shouldCheckForMatches(inst)) {
                    return commit$;
                }
                return dataService.matchInstances(inst).pipe(
                    concatMap(matches => {
                        if (matches && matches.length > 0) {
                            matchedGroups.push({ newInstance: inst, matches });
                            return EMPTY;
                        }
                        return commit$;
                    })
                );
            }),
            finalize(() => this.closeCommitWaitDialog())
        ).subscribe({
            next: resultGroup => results.push(...resultGroup),
            error: err => console.error('Error committing new instances', err),
            complete: () => {
                onComplete?.();
                if (matchedGroups.length === 0) {
                    if (results.length > 0) this.commitResultDialogService.openDialog(results);
                    return;
                }
                this.matchedInstancesDialogService.openDialog({
                    title: 'Matches Found',
                    groups: matchedGroups
                }).afterClosed().subscribe((resolutions?: MatchResolution[]) => {
                    // Apply "use existing" / "merge" resolutions (side effects) and get back the
                    // held-back new instances the user chose to commit anyway.
                    matchResolutionService.resolve(resolutions).pipe(take(1)).subscribe(toCommit => {
                        if (toCommit.length === 0) {
                            if (results.length > 0) this.commitResultDialogService.openDialog(results);
                            return;
                        }

                        // Commit the selected new instances that were held back due to matches.
                        this.openCommitWaitDialog(
                            'Committing New Instances',
                            'Please wait while selected new instances are committed one by one.'
                        );
                        from(toCommit).pipe(
                            concatMap(inst => dataService.commit(inst).pipe(
                                tap(rtn => this.processCommit(inst, rtn, dataService)),
                                map(rtn => this.buildCommitSummaryResults(inst, rtn))
                            )),
                            finalize(() => this.closeCommitWaitDialog())
                        ).subscribe({
                            next: resultGroup => results.push(...resultGroup),
                            error: err => console.error('Error committing matched new instances', err),
                            complete: () => {
                                if (results.length > 0) this.commitResultDialogService.openDialog(results);
                            }
                        });
                    });
                });
            }
        });
    }

    private openCommitWaitDialog(title: string, message: string) {
        this.closeCommitWaitDialog();
        this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
            disableClose: true,
            hasBackdrop: true,
            autoFocus: false,
            restoreFocus: false,
            data: { title, message }
        });
    }

    private closeCommitWaitDialog() {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
    }

    initialzeSelectedInstances(listName: string) {
        this.listName2selectedInstances.set(listName, []);
    }

    private selectedInstancesSubject = new Map<string, Subject<Instance[]>>();

    getSelectedInstances(listName: string) {
        if (!this.selectedInstancesSubject.has(listName)) {
            this.selectedInstancesSubject.set(listName, new Subject<Instance[]>());
        }
        // Emit the current value immediately for new subscribers
        setTimeout(() => {
            this.selectedInstancesSubject.get(listName)!.next(this.listName2selectedInstances.get(listName) ?? []);
        });
        return this.selectedInstancesSubject.get(listName)!.asObservable();
    }

    // Update these methods to emit changes:
    addSelectedInstance(listName: string, inst: Instance) {
        let selectedInsts = this.listName2selectedInstances.get(listName);
        if (!selectedInsts) {
            selectedInsts = [];
            this.listName2selectedInstances.set(listName, selectedInsts);
        }
        if (!selectedInsts.find(i => i.dbId === inst.dbId))
            selectedInsts.push(inst);
        this.selectedInstancesSubject.get(listName)?.next([...selectedInsts]);
    }

    removeSelectedInstance(listName: string, inst: Instance) {
        let selectedInsts = this.listName2selectedInstances.get(listName);
        if (!selectedInsts) return;
        const index = selectedInsts.findIndex(i => i.dbId === inst.dbId);
        if (index >= 0)
            selectedInsts.splice(index, 1);
        this.selectedInstancesSubject.get(listName)?.next([...selectedInsts]);
    }

    clearSelectedInstances(listName: string) {
        this.listName2selectedInstances.set(listName, []);
        this.selectedInstancesSubject.get(listName)?.next([]);
    }

    isInstanceSelected(listName: string, inst: Instance): boolean {
        let selectedInsts = this.listName2selectedInstances.get(listName);
        if (!selectedInsts) return false;
        return selectedInsts.find(i => i.dbId === inst.dbId) !== undefined;
    }

    setSelectedInstances(listName: string, instances: Instance[]): void {
        this.listName2selectedInstances.set(listName, instances);
        this.selectedInstancesSubject.get(listName)?.next([...instances]);
    }

    addSelectedInstances(listName: string, instances: Instance[]): void {
        let selectedInsts = this.listName2selectedInstances.get(listName);
        if (!selectedInsts) {
            selectedInsts = [];
            this.listName2selectedInstances.set(listName, selectedInsts);
        }
        for (let inst of instances) {
            if (!selectedInsts.find(i => i.dbId === inst.dbId))
                selectedInsts.push(inst);
        }
        this.selectedInstancesSubject.get(listName)?.next([...selectedInsts]);
    }

    isInstanceModified(inst: Instance): boolean {
        let schemaAttributes: SchemaAttribute[] = inst.schemaClass?.attributes ? inst.schemaClass.attributes : [];
        for (const attribute of schemaAttributes) {
            let values = inst.attributes?.get(attribute.name);
            let referenceValues = inst.source?.attributes?.get(attribute.name);
            if (!values)
                values = [];
            if (!Array.isArray(values)) { values = [values]; }
            if (!referenceValues)
                return false; // If no source, no filter has been applied, no edits
            //referenceValues = [];
            if (!Array.isArray(referenceValues)) { referenceValues = [referenceValues]; }
            // if the values for a shared attribute differ, add them to be displayed 

            if (values.length !== referenceValues.length) {
                return true;
            }

            for (let i = 0; i < values.length; i++) {
                const val = values[i];
                const refVal = referenceValues[i];
                if (attribute.type === AttributeDataType.INSTANCE) {
                    if (val?.dbId && refVal?.dbId && val.dbId !== refVal.dbId) {
                        return true; // once one value is different, add the whole attribute
                    }
                } else {
                    if (val !== refVal) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
