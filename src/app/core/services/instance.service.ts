import { Injectable } from "@angular/core";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "./data.service";
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute, SchemaClass } from "../models/reactome-schema.model";
import { Subject, take } from "rxjs";
import { Store } from "@ngrx/store";
import { deleteInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";

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

    // Call this when an database is marked as deletion but not yet committed to
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

    constructor(private store: Store) { }

    setLastUpdatedInstance(attribute: string, instance: Instance) {
        this.lastUpdatedInstance.next({
            attribute: attribute,
            instance: instance
        });
    }

    setCommittedNewInstDbId(oldDbId: number, newDbId: number) {
        this.committedNewInstDbId.next([oldDbId, newDbId]);
    }

    setDeletedDbId(dbId: number) {
        this.deletedDbId.next(dbId);
    }

    setMarkDeletionDbId(dbId: number) {
        this.markDeletionDbId.next(dbId);
    }

    setResetInstance(modifiedAtts: string[] | undefined, dbId: number) {
        this.resetInst.next({ modifiedAttributes: modifiedAtts, dbId: dbId });
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

    isSchemaClass(instance: Instance, schemaClass?: SchemaClass): boolean {
        //let schemaClass = dataService.getSchemaClass(className);
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
        return allClsNames.has(instance.schemaClassName);
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
            attributeMap.set(key, value);
        })
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

    removeInstInArray(target: Instance, array: Instance[]) {
        if (!array) return;
        const index = array.findIndex(obj => obj.dbId === target.dbId);
        if (index >= 0)
            array.splice(index, 1);
    }

    applyLocalDeletions(inst: Instance) {
        this.store.select(deleteInstances()).pipe(take(1)).subscribe(insts => {
            if (!insts || insts.length === 0 || !inst.attributes)
                return;
            const dbIds = insts.map(inst => inst.dbId);
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
                else if (attValue.dbId && dbIds.includes(attValue.dbId)) {
                    inst.attributes.set(att, undefined);
                    this.addToModifiedAttribute(att, inst);
                }
            }
        });
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

}
