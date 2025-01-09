import { Injectable } from "@angular/core";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "./data.service";
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute, SchemaClass } from "../models/reactome-schema.model";
import { Subject, take } from "rxjs";
import { Store } from "@ngrx/store";
import { deleteInstances } from "src/app/instance/state/instance.selectors";
import { NewInstanceActions, UpdateInstanceActions } from "src/app/instance/state/instance.actions";

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

    constructor(private store: Store) { }

    /**
     * Track display name change for instance so that we can update display name in view.
     * @param instance 
     */
    registerDisplayNameChange(instance: Instance) {
        this.dbId2displayName.set(instance.dbId, instance.displayName);
        const shell = this.shellInstances.get(instance.dbId);
        if (shell)
            shell.displayName = instance.displayName;
        this.setRefreshViewDbId(instance.dbId);
    }

    setLastUpdatedInstance(attribute: string, instance: Instance) {
        this.lastUpdatedInstance.next({
            attribute: attribute,
            instance: instance
        });
    }

    setCommittedNewInstDbId(oldDbId: number, newDbId: number) {
        let shell = this.shellInstances.get(oldDbId);
        if (shell) {
            shell.dbId = newDbId;
            this.shellInstances.delete(oldDbId);
            this.shellInstances.set(newDbId, shell);
        }
        this.committedNewInstDbId.next([oldDbId, newDbId]);
    }

    setDeletedDbId(dbId: number) {
        this.deletedDbId.next(dbId);
    }

    setMarkDeletionDbId(dbId: number) {
        this.markDeletionDbId.next(dbId);
    }

    setResetInstance(modifiedAtts: string[] | undefined, inst: Instance) {
        // Call this first in case the name is needed
        this.dbId2displayName.set(inst.dbId, inst.displayName);
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

    _isSchemaClass(instanceSchemaClassName: string, schemaClass: SchemaClass | undefined): boolean {
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
        return allClsNames.has(instanceSchemaClassName);
    }

    isSchemaClass(instance: Instance, className: string, dataService: DataService): boolean {
        let schemaClass = dataService.getSchemaClass(className);
        return this._isSchemaClass(instance.schemaClass!.name, schemaClass);
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
            displayName: inst.displayName
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
        }
        return shell;
    }

    removeInstInArray(target: Instance, array: Instance[]) {
        if (!array) return;
        const index = array.findIndex(obj => obj.dbId === target.dbId);
        if (index >= 0)
            array.splice(index, 1);
    }

    applyLocalDeletions(inst: Instance, deletedInsts: Instance[]) {
        if (!deletedInsts || deletedInsts.length === 0 || !inst.attributes)
            return;
        const dbIds = deletedInsts.map(inst => inst.dbId);
        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue)
                continue;
            if (Array.isArray(attValue)) {
                for (let i = 0; i < attValue.length; i++) {
                    const attValue1 = attValue[i];
                    if (!attValue1.dbId)
                        break; // This is not a instance type attribute
                    if (dbIds.includes(attValue1.dbId)) {
                        attValue.splice(i, 1);
                        i--;
                        this.addToModifiedAttribute(att, inst);
                    }
                }
            }
            // We cannot use instanceof to check if attValue is an Instance
            // But we can check if it has dbId
            else if (attValue.dbId) {
                if (dbIds.includes(attValue.dbId)) {
                    // Remove this attribute since nothing is there
                    inst.attributes.delete(att);
                    this.addToModifiedAttribute(att, inst);
                }
            }
        }
    }

    validateReferDisplayName(inst: Instance, updatedInsts: Instance[]) {
        if (!inst.attributes)
            return;
        const dbId2updatedInst = new Map(updatedInsts.map(inst => [inst.dbId, inst]));
        for (let att of inst.attributes.keys()) {
            const attValue = inst.attributes.get(att);
            if (!attValue)
                continue;
            if (Array.isArray(attValue)) {
                for (let i = 0; i < attValue.length; i++) {
                    const attValue1 = attValue[i];
                    if (!attValue1.dbId)
                        break; // This is not a instance type attribute
                    // check update first
                    if (dbId2updatedInst.has(attValue1.dbId)) {
                        const currentName = dbId2updatedInst.get(attValue1.dbId)?.displayName;
                        if (currentName !== attValue1.displayName)
                            attValue1.displayName = currentName;
                    }
                    else if (this.dbId2displayName.has(attValue1.dbId)) {
                        // updated instance may be reset or committed, so it is not in the updatedInst
                        // any more
                        // Its display name has been changed
                        // Since this is a shell instance, no need to set attribute here
                        const currentName = this.dbId2displayName.get(attValue1.dbId);
                        if (currentName !== attValue1.displayName)
                            attValue1.displayName = currentName;
                    }
                }
            }
            // We cannot use instanceof to check if attValue is an Instance
            // But we can check if it has dbId
            else if (attValue.dbId) {
                if (dbId2updatedInst.has(attValue.dbId)) {
                    const currentName = dbId2updatedInst.get(attValue.dbId)?.displayName;
                    if (currentName !== attValue.displayName)
                        attValue.displayName = currentName;
                }
                else if (this.dbId2displayName.has(attValue.dbId)) {
                    attValue.displayName = this.dbId2displayName.get(attValue.dbId);
                }
            }
        }
    }

    /**
     * Check if the first instance, of which dbId is passed, is a reference of the second instnace
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

    private addToModifiedAttribute(att: string, inst: Instance) {
        if (!inst.modifiedAttributes)
            inst.modifiedAttributes = [];
        if (!inst.modifiedAttributes.includes(att))
            inst.modifiedAttributes.push(att);
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
        if (source.modifiedAttributes && source.modifiedAttributes.length)
            instance.modifiedAttributes = [...source.modifiedAttributes]
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

    /**
     * Handle post processing after committing an instance to the database.
     * @param instance 
     */
    processCommit(committedInst: Instance, rtnInst: Instance, dataService: DataService) {
        if (committedInst.dbId >= 0) { // This is an updated instance
            this.store.dispatch(UpdateInstanceActions.remove_updated_instance(committedInst));
            this.setRefreshViewDbId(committedInst.dbId);
        }
        else if (committedInst.dbId < 0) { // This is a new instance
            this.store.dispatch(NewInstanceActions.remove_new_instance(committedInst));
            this.store.dispatch(NewInstanceActions.commit_new_instance({ oldDbId: committedInst.dbId,
                                                                         newDbId: rtnInst.dbId }));
            dataService.flagSchemaTreeForReload()
        }
        // Make sure new instances are updated if any
        if (rtnInst.newInstOld2NewId) {
            // Have to use this temp variable to avoid type error
            let old2newId: any = rtnInst.newInstOld2NewId!;
            Object.keys(old2newId).map((oldId) => {
                const oldDbId: number = parseInt(oldId, 10);
                const newDbId: number = old2newId[oldId];
                const shell = this.shellInstances.get(oldDbId);
                if (shell) {
                    this.store.dispatch(NewInstanceActions.remove_new_instance(shell));
                    this.store.dispatch(NewInstanceActions.commit_new_instance({ oldDbId: oldDbId,
                                                                                 newDbId: newDbId }));
                }
            });
        }
    }

}
