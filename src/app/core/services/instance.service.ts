import { Injectable } from "@angular/core";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "./data.service";
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute, SchemaClass } from "../models/reactome-schema.model";
import { Subject } from "rxjs";

/**
 * Group a set of utility methods here for easy access to all other classes.
 */
@Injectable({
    providedIn: 'root'
})
export class InstanceUtilities {
    // Track any instance click such as in table, list, etc.
    // The type if either string or number
    private lastClickedDbId = new Subject<string|number>();
    lastClickedDbId$ = this.lastClickedDbId.asObservable();

    // A shortcut to notify an instance view refresh
    // We use this method to make the code much, much simpler!
    private refreshViewDbId = new Subject<number>();
    refreshViewDbId$ = this.refreshViewDbId.asObservable();

    private deletedDbId = new Subject<number>();
    deletedDbId$ = this.deletedDbId.asObservable();

    // The first is the old dbId and second newDbId
    private committedNewInstDbId = new Subject<[number, number]>();
    committedNewInstDbId$ = this.committedNewInstDbId.asObservable();

    // Bypass for comparison
    private lastClickedDbIdForComparison = new Subject<number>();
    lastClickedDbIdForComparison$ = this.lastClickedDbIdForComparison.asObservable();

    // reset instance 
    private resetInst = new Subject<{modifiedAttributes: string[]|undefined, dbId: number}>();
    resetInst$ = this.resetInst.asObservable();

    constructor() { }

    setCommittedNewInstDbId(oldDbId: number, newDbId: number) {
        this.committedNewInstDbId.next([oldDbId, newDbId]);
    }

    setDeletedDbId(dbId: number) {
        this.deletedDbId.next(dbId);
    }

    setResetInstance(modifiedAtts: string[]|undefined, dbId: number) {
        this.resetInst.next({modifiedAttributes: modifiedAtts, dbId: dbId});
    }

    setRefreshViewDbId(dbId: number) {
        this.refreshViewDbId.next(dbId);
    }

    setLastClickedDbId(dbId: string|number) {
        this.lastClickedDbId.next(dbId);
    }

    setLastClickedDbIdForComparison(dbId: number) {
        this.lastClickedDbIdForComparison.next(dbId);
    }

    isSchemaClass(instance: Instance, className: string, dataService: DataService): boolean {
        let schemaClass = dataService.getSchemaClass(className);
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

}
