import { HttpClient } from "@angular/common/http";
import { Injectable } from '@angular/core';
import { catchError, concatMap, map, Observable, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute, SchemaClass } from '../models/reactome-schema.model';
// import { AttributeDa } from '../models/schema-class-attribute-data.model';
import { Instance } from "../models/reactome-instance.model";


@Injectable({
  providedIn: 'root'
})

/**
 * This class is used to fetch instance and class definition from the RESTful API. 
 */
export class DataService {
  // Cache fetched SchemaClass objects
  private name2SchemaClass: Map<string, SchemaClass> = new Map<string, SchemaClass>();
  // Cache fetched instances
  private id2instance: Map<number, Instance> = new Map<number, Instance>();
  schemaClassDataUrl = `${environment.ApiRoot}/getAttributes/` // TODO: Need to consider using Angular ConfigService!
  entityDataUrl = `${environment.ApiRoot}/findByDbId/`;
  // Track the negative dbId to be used
  private nextNewDbId: number = -1;

  constructor(private http: HttpClient) {
  }

  /**
   * Fetch the instance data.
   * @param className
   * @returns 
   */
  fetchSchemaClass(className: string): Observable<SchemaClass> {
    // Check cached results first
    if (this.name2SchemaClass.has(className)) {
      return of(this.name2SchemaClass.get(className)!);
    }
    // Otherwise call the restful API
    return this.http.get<SchemaClass>(this.schemaClassDataUrl + `${className}`)
      .pipe(
        map((data: any) => {
          // console.log("fetchSchemaClass:");
          // console.log(data);
          // convert data to schemaClass
          let schemaCls = this.convertToSchemaClass(className, data);
          this.name2SchemaClass.set(schemaCls.name, schemaCls);
          return schemaCls;
        }),
        catchError((err: Error) => {
          console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  /**
   * A helper function to convert a JSON array into a SchemaClass so that it is easier to model.
   * @param data
   */
  private convertToSchemaClass(clsName: string, data: any): SchemaClass {
    let attributes: SchemaAttribute[] = [];
    for (let element of data) {
      let properties = element.properties;
      // Something not right with deletedInstanceDB_ID: no proprties.
      // Need to check why. Escape for the time being
      if (properties === undefined) continue;
      let categoryKey: keyof typeof AttributeCategory = element.category[1];
      let definingTypeKey: keyof typeof AttributeDefiningType = element.definingType[1];
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
  private getAllowedClasses(attributeClasses: any): string[] {
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
   * An Instance object needs to have its SchemaClass loaded first. Therefore,
   * this function makes two calls: 1). Get the instance first; 2). Get the SchemaClass
   * for the instance. Both of them may be cached in this object.
   * Note: fetch homo sapien (DBID = 48887) is very slow, most likely caused by the many references
   * This slowness is not caused by loading the Species schema class!
   * @param dbId 
   */
  fetchInstance(dbId: number): Observable<Instance> {
    // Check cached results first
    if (this.id2instance.has(dbId)) {
      return of(this.id2instance.get(dbId)!);
    }
    // Fetch from the server
    return this.http.get<Instance>(this.entityDataUrl + `${dbId}`)
      .pipe(
        concatMap((data: any) => {
          // Convert the data into an Instance object.
          let instance: Instance = this.convertToInstance(data);
          this.id2instance.set(dbId, instance); // Cache this instance
          return this.handleSchemaClassForInstance(instance);
        }),

        catchError((err: Error) => {
          console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }),
      );
  }

  /**
   * Create a new instance for the specified class.
   */
  createNewInstance(schemaClassName: string): Observable<Instance> {
    return this.fetchSchemaClass(schemaClassName).pipe(map((schemaClass: SchemaClass) => {
      const attributes = new Map();
      attributes.set('dbId', this.nextNewDbId);
      this.nextNewDbId -= 1;
      attributes.set('displayName', 'To be generated');
      let instance: Instance = {
        dbId: attributes.get('dbId'),
        displayName: attributes.get('displayName'),
        attributes: attributes
      };
      instance.schemaClass = schemaClass;
      this.normalizeAttributes(instance);
      return instance;
    }),
      catchError((err: Error) => {
        console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => err);
      }),
    );
  }

  /**
   * Register a new instance to the cache.
   */
  registerNewInstance(instance: Instance): void {
    this.id2instance.set(instance.dbId, instance);
  }

  /**
   * Convert a JSON object returned from the RESTful API into an Instance defined in the web front.
   * @param data 
   */
  private convertToInstance(data: any): Instance {
    let instance: Instance = {
      dbId: data['dbId'],
      displayName: data['displayName'],
      isShell: false, // Should be fully loaded
      isDirty: false, // Not edited yet since it is just loaded.
      schemaClassName: this.getClassName(data['@JavaClass'])
    };
    // Hold attribute values for the time being.
    // Will be refined after get the SchemaClass.
    let attributes = new Map<string, any>();
    Object.keys(data).map((key: string) => {
      const value = data[key];
      attributes.set(key, value);
    });
    instance.attributes = attributes;
    return instance;
  }

  /**
   * Add the SchemaClass to a fetched instance. The schemaclass may be cached or needed
   * to be fetched directly from the backend.
   * @param className
   * @returns 
   */
  private handleSchemaClassForInstance(instance: Instance): Observable<Instance> {
    let className: string = instance.schemaClassName!;
    let schemaClass$: Observable<SchemaClass> = this.fetchSchemaClass(className);
    return schemaClass$.pipe(
      map((schemaClass: SchemaClass) => {
        instance.schemaClass = schemaClass;
        this.normalizeAttributes(instance);
        return instance;
      })
    );
  }

  /**
   * Make sure attributes in the instances are consistent with the defintion in the SchemaClass.
   * @param instance
   */
  private normalizeAttributes(instance: Instance): void {
    // Since some referred instances may be returned with dbIds only, therefore, two passes
    // are performed here
    let id2instance: Map<number, Instance> = new Map<number, Instance>();
    for (let attribute of instance.schemaClass?.attributes!) {
      if (attribute.type !== AttributeDataType.INSTANCE)
        continue;
      let value = instance.attributes?.get(attribute.name);
      if (value === undefined)
        continue; // Nothing to do
      if (attribute.cardinality === '1') {
        if (value instanceof Object) {
          let attributeInstance = {
            dbId: value.dbId,
            displayName: value.displayName
          };
          id2instance.set(attributeInstance.dbId,
            attributeInstance);
          instance.attributes?.set(attribute.name, attributeInstance);
        }
        else if (typeof value === 'number') {
          let attributeInstance = {
            dbId: value,
            displayName: undefined
          };
          instance.attributes?.set(attribute.name, attributeInstance);
        }
      }
      else { // This is a list
        let attributeInstanceList: Instance[] = [];
        for (let value1 of value) {
          if (value1 instanceof Object) {
            let attributeInstance = {
              dbId: value1.dbId,
              displayName: value1.displayName
            };
            id2instance.set(attributeInstance.dbId,
              attributeInstance);
            attributeInstanceList.push(attributeInstance);
          }
          else if (typeof value1 === 'number') {
            let attributeInstance = {
              dbId: value1,
              displayName: undefined
            };
            attributeInstanceList.push(attributeInstance);
          }
        }
        instance.attributes?.set(attribute.name, attributeInstanceList);
      }
    }
    // The second pass to make sure all instances have displayName setting
    for (let attribute of instance.schemaClass?.attributes!) {
      if (attribute.type !== AttributeDataType.INSTANCE)
        continue;
      let value = instance.attributes?.get(attribute.name);
      if (value === undefined)
        continue; // Nothing to do
      if (attribute.cardinality === '1') {
        if (value.displayName === undefined) {
          let otherValue = id2instance.get(value.dbId);
          if (otherValue !== undefined) {
            value.displayName = otherValue.displayName; // Here we use a new copy of instance. Since this is light weight, it should be fine.
          }
        }
      }
      else { // This is a list
        for (let value1 of value) {
          if (value1.displayName === undefined) {
            let otherValue = id2instance.get(value1.dbId);
            if (otherValue !== undefined) {
              value1.displayName = otherValue.displayName;
            }
          }
        }
      }
    }
  }

  fetchSchemaClasses(): Observable<string[]> {
    let stringArray: string[] = [];
    return this.http.get<string[]>(`http://localhost:8080/api/curation/getSchemaClasses`)
      .pipe(map((data: string[]) => {
        return data;
      }));
  }
}