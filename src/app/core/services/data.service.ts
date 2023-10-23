import {HttpClient} from "@angular/common/http";
import {Injectable} from '@angular/core';
import {catchError, concatMap, map, Observable, of, throwError} from 'rxjs';
import {environment} from 'src/environments/environment.dev';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass
} from '../models/reactome-schema.model';
// import { AttributeDa } from '../models/schema-class-attribute-data.model';
import {Instance} from "../models/reactome-instance.model";
import {InstanceList} from "../models/schema-class-instance-list.model";


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
  private schemaClassDataUrl = `${environment.ApiRoot}/getAttributes/` // TODO: Need to consider using Angular ConfigService!
  private entityDataUrl = `${environment.ApiRoot}/findByDbId/`;
  private schemaClassTreeUrl = `${environment.ApiRoot}/getSchemaClassTree/`;
  private listInstancesUrl = `${environment.ApiRoot}/listInstances/`
  // Track the negative dbId to be used
  private nextNewDbId: number = -1;
  // The root class is cached for performance
  private rootClass: SchemaClass | undefined;
  private name2class?: Map<string, SchemaClass>;

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
   * Fetch the schema class tree.
   * @param className
   * @returns
   */
  fetchSchemaClassTree(): Observable<SchemaClass> {
    // Check cached results first
    if (this.rootClass) {
      return of(this.rootClass!);
    }
    // Otherwise call the restful API
    return this.http.get<SchemaClass>(this.schemaClassTreeUrl)
      .pipe(
        map((data: SchemaClass) => {
          console.debug("fetchSchemaClassTree:", data);
          this.rootClass = data;
          return this.rootClass;
        }),
        catchError((err: Error) => {
          console.log("The schema class tree could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  getSchemaClass(clsName: string): SchemaClass | undefined {
    if (this.name2class)
      return this.name2class.get(clsName);
    this.name2class = new Map<string, SchemaClass>();
    if (this.rootClass)
      this.buildSchemaClassMap(this.rootClass, this.name2class);
    else
      console.error("The class tree has not been loaded. No map cannot be returned!");
    return this.name2class.get(clsName);
  }

  private buildSchemaClassMap(schemaClass: SchemaClass, name2class: Map<string, SchemaClass>) {
    name2class.set(schemaClass.name, schemaClass);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        this.buildSchemaClassMap(child, name2class);
      }
    }
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
        concatMap((data: Instance) => {
          let instance: Instance = data; // Converted into the Instance object already
          this.handleInstanceAttributes(instance);
          this.id2instance.set(dbId, instance); // Cache this instance
          return this.handleSchemaClassForInstance(instance);
        }),

        catchError((err: Error) => {
          console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
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
        return instance;
      }),
      catchError((err: Error) => {
        console.log("The dataset options could not been loaded: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 100
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
   * Attributes returned from the server are kept as JavaScript object since JavaScript really
   * doesn't care about the type. Therefore, we need to do some converting here.
   * @param instance
   */
  private handleInstanceAttributes(instance: Instance): void {
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
        return instance;
      })
    );
  }

  /**
   * Fetch the list of instances for a schema class.
   * @param className
   * @returns
   */
  listInstances(className: string): Observable<InstanceList[]> {
    // TODO: Check cached results first?

    // Otherwise call the restful API
    return this.http.get<InstanceList[]>(this.listInstancesUrl + `${className}/` + `${1}/` + `${100}`)
      .pipe(map((data: InstanceList[]) => {
          return data.map(instance => new InstanceList(instance.dbId, instance.displayName));
        }),
        catchError((err: Error) => {
          console.log("The list of instances could not be loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

}
