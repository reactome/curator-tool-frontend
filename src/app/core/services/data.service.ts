import { HttpClient } from "@angular/common/http";
import { Injectable } from '@angular/core';
import { catchError, concatMap, forkJoin, from, map, Observable, of, Subject, switchMap, throwError, toArray } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { Instance, InstanceList, NEW_DISPLAY_NAME, Referrer, UserInstances } from "../models/reactome-instance.model";
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass
} from '../models/reactome-schema.model';
import { InstanceUtilities } from "./instance.service";


@Injectable({
  providedIn: 'root'
})
/**
 * This class is used to fetch instance and class definition from the RESTful API.
 */
export class DataService {
  // Cache fetched SchemaClass objects
  // This map caches loaded schema class that has attributes defined
  private name2SchemaClass: Map<string, SchemaClass> = new Map<string, SchemaClass>();
  // This map is used to make schema class traveral easy. The SchemaClass in this map
  // is not loaded, i.e., without attributes
  private name2SimpleClass: Map<string, SchemaClass> = new Map<string, SchemaClass>();
  // Cache fetched instances
  // List of URLs
  private id2instance: Map<number, Instance> = new Map<number, Instance>();
  private schemaClassDataUrl = `${environment.ApiRoot}/getAttributes/` // TODO: Need to consider using Angular ConfigService!
  private entityDataUrl = `${environment.ApiRoot}/findByDbId/`;
  private schemaClassTreeUrl = `${environment.ApiRoot}/getSchemaClassTree/`;
  private eventsTreeUrl = `${environment.ApiRoot}/getEventTree/`;
  private listInstancesUrl = `${environment.ApiRoot}/listInstances/`;
  private searchInstancesUrl = `${environment.ApiRoot}/searchInstances/`;
  private findInstanceByDisplayNameUrl = `${environment.ApiRoot}/findByDisplayName`;
  private commitInstanceUrl = `${environment.ApiRoot}/commit/`;
  private fillReferenceUrl = `${environment.ApiRoot}/fillReference/`;
  private eventPlotDataUrl = `${environment.ApiRoot}/getEventPlotData/`;
  private testQACheckReportUrl = `${environment.ApiRoot}/getTestQACheckReport/`;
  private loadInstancesUrl = `${environment.ApiRoot}/loadInstances/`;
  private persistInstancesUrl = `${environment.ApiRoot}/persistInstances/`;
  private deletePersistedInstancesUrl = `${environment.ApiRoot}/deletePersistedInstances/`;
  private fetchReactionParticipantsUrl = `${environment.ApiRoot}/fetchReactionWithParticipants/`;
  private getReferrersUrl = `${environment.ApiRoot}/getReferrers/`;
  private uploadCyNetworkUrl = `${environment.ApiRoot}/uploadCyNetwork/`;
  private hasCyNetworkUrl = `${environment.ApiRoot}/hasCyNetwork/`;
  private getCyNetworkUrl = `${environment.ApiRoot}/getCyNetwork/`;
  private deleteSimpleInstance = `${environment.ApiRoot}/delete/`;


  // Track the negative dbId to be used
  private nextNewDbId: number = -1;
  // The root class is cached for performance
  private rootClass: SchemaClass | undefined;
  private rootEvent: Instance | undefined;

  // Use this subject to force waiting for components to fetch instance
  // since we need to load changed instances from cached storage first
  private loadInstanceSubject : Subject<void> | undefined = undefined;

  constructor(private http: HttpClient,
    private utils: InstanceUtilities
  ) {
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
          console.debug("fetchSchemaClass: " + className);
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
   * Fetch a list of schema classes for the provided name list.
   * @param dbIds 
   */
  fetchSchemaClasses(names: string[]): Observable<SchemaClass[]> {
    const observables: Observable<SchemaClass>[] = names.map((name: string) => this.fetchSchemaClass(name));
    return forkJoin(observables);
  }

  /**
   * Fetch the schema class table.
   * @param skipCache
   * @returns
   */
  fetchSchemaClassTree(skipCache?: boolean): Observable<SchemaClass> {
    // Check cached results first
    if (this.rootClass && !skipCache) {
      return of(this.rootClass!);
    }
    // Otherwise call the restful API
    let url = this.schemaClassTreeUrl;
    return this.http.get<SchemaClass>(url)
      .pipe(
        map((data: SchemaClass) => {
          // console.debug("fetchSchemaClassTree:", data);
          this.rootClass = data;
          // Let's just cache everything here
          this.buildSchemaClassMap(this.rootClass, this.name2SimpleClass);
          return this.rootClass;
        }),
        catchError((err: Error) => {
          console.debug("The schema class table could not been loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  /**
   * Fetch Event Tree
   * @param skipCache
   * @param selectedSpecies
   */
  fetchEventTree(skipCache: boolean, speciesName: string): Observable<Instance> {
    //Check cached results first
    if (this.rootEvent && !skipCache) {
      return of(this.rootEvent!);
    }
    // Otherwise call the restful API
    return this.http.get<Array<Instance>>(this.eventsTreeUrl + speciesName)
      .pipe(
        map((data: Array<Instance>) => {
          let rootEvent: Instance = {
            dbId: 0,
            displayName: "TopLevelPathway",
            schemaClassName: "TopLevelPathway",
            attributes: {"hasEvent": data}
          };
          this.rootEvent = rootEvent;
          return rootEvent;
        }),
        catchError((err: Error) => {
          console.log("The events tree could not be loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  /**
   * The class returned from this method call has no attributes loaded. These classes are
   * used to figure out the hierarchical relationships!!!
   * @param clsName 
   * @returns 
   */
  getSchemaClass(clsName: string): SchemaClass | undefined {
    if (this.name2SimpleClass && this.name2SimpleClass.size > 0) {
      return this.name2SimpleClass.get(clsName);
    }
    if (this.rootClass)
      this.buildSchemaClassMap(this.rootClass, this.name2SimpleClass);
    else
      console.error("The class table has not been loaded. No map can be returned!");
    return this.name2SimpleClass.get(clsName);
  }

  private buildSchemaClassMap(schemaClass: SchemaClass, name2schemaclass: Map<string, SchemaClass>) {
    name2schemaclass.set(schemaClass.name, schemaClass);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        this.buildSchemaClassMap(child, name2schemaclass);
      }
    }
  }

  /**
   * A helper function to convert a JSON array into a SchemaClass so that it is easier to model.
   * @param data
   */
  private convertToSchemaClass(clsName: string, data: any): SchemaClass {
    return this.utils.convertToSchemaClass(clsName, data);
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
    // During the load changed instance. Have to wait until that loading is finished
    // so that the changed instance is used instead the DB version.
    if (this.loadInstanceSubject) {
      return this.loadInstanceSubject.pipe(concatMap(() => {
        return this._fetchInstance(dbId);
      }));
    }
    else {
      return this._fetchInstance(dbId);
    }
  }

  _fetchInstance(dbId: number): Observable<Instance> {
    // Check cached results first
    if (this.id2instance.has(dbId)) {
      return of(this.id2instance.get(dbId)!);
    }
    return this.fetchInstanceFromDatabase(dbId, true);
  }

  /**
   * Fetch a list of intances for the provided dbIds list.
   * @param dbIds 
   */
  fetchInstances(dbIds: number[]): Observable<Instance[]> {
    const observables: Observable<Instance>[] = dbIds.map((dbId: number) => this.fetchInstance(dbId));

    return forkJoin(observables);
  }

  /**
   * Fetch the reaction with all participants so that it can be laid out in a
   * pathway diagram.
   * Note: the attributes here don't follow the schema definition of ReactionLikeEvent.
   * @param dbId
   * @returns
   */
  fetchReactionParticipants(dbId: number): Observable<Instance> {
    return this.http.get<Instance>(this.fetchReactionParticipantsUrl + `${dbId}`)
      .pipe(map((data: Instance) => {
        let instance: Instance = data; // Converted into the Instance object already
        this.handleInstanceAttributes(instance);
        return instance;
      }),
        catchError((err: Error) => {
          console.log("Cannot fetch participants for `${dbId}`: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
          });
          return throwError(() => err);
        }),
      );
  }

  fetchInstanceFromDatabase(dbId: number, cache: boolean): Observable<Instance> {
    // Fetch from the server
    return this.http.get<Instance>(this.entityDataUrl + `${dbId}`)
      .pipe(
        concatMap((data: Instance) => {
          let instance: Instance = data; // Converted into the Instance object already
          this.handleInstanceAttributes(instance);
          if (cache)
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

  fetchEventPlotData(dbId: number, plotType: string): Observable<JSON> {
    return this.http.get<JSON>(this.eventPlotDataUrl + `${dbId}` + "?type=" + plotType)
      .pipe(map((data: JSON) => data),
        catchError((err: Error) => {
          console.log("Plot data could not be retrieved: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
          });
          return throwError(() => err);
        }),
      );
  }

  getNextNewDbId(): number {
    let rtn = this.nextNewDbId;
    this.nextNewDbId -= 1;
    return rtn;
  }

  resetNextNewDbId() {
    if (!this.id2instance || this.id2instance.size == 0) {
      return; // Need to do nothing
    }
    let min = 0;
    for (let id of this.id2instance.keys()) {
      if (id < min)
        min = id;
    }
    // Need to reduce 0 to avoid using the used one
    this.nextNewDbId = min - 1;
  }

  /**
   * Create a new instance for the specified class.
   */
  createNewInstance(schemaClassName: string): Observable<Instance> {
    return this.fetchSchemaClass(schemaClassName).pipe(map((schemaClass: SchemaClass) => {
        const attributes = new Map();
        attributes.set('dbId', this.getNextNewDbId());
        attributes.set('displayName', NEW_DISPLAY_NAME);
        let instance: Instance = {
          dbId: attributes.get('dbId'),
          displayName: attributes.get('displayName'),
          schemaClassName: schemaClassName,
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
  registerInstance(instance: Instance): void {
    // Make sure map is used
    if (instance.attributes && !(instance.attributes instanceof Map)) {
      this.handleInstanceAttributes(instance);
    }
    this.id2instance.set(instance.dbId, instance);
  }

  removeInstanceInCache(instance: Instance): void {
    if (this.id2instance.has(instance.dbId))
      this.id2instance.delete(instance.dbId);
  }

  /**
   * Attributes returned from the server are kept as JavaScript object since JavaScript really
   * doesn't care about the type. Therefore, we need to do some converting here.
   * @param instance
   */
  handleInstanceAttributes(instance: Instance): void {
    this.utils.handleInstanceAttributes(instance);
  }

  /**
   * Add the SchemaClass to a fetched instance. The schemaclass may be cached or needed
   * to be fetched directly from the backend.
   * @param className
   * @returns
   */
  handleSchemaClassForInstance(instance: Instance): Observable<Instance> {
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
   * @param skip
   * @param limit
   * @param searchKey
   * @returns
   */
  listInstances(className: string,
                skip: number,
                limit: number,
                searchKey: string | undefined) {
    let url = this.listInstancesUrl + `${className}/` + `${skip}/` + `${limit}`;
    if (searchKey && searchKey.trim().length > 0) {
      url += '?query=' + searchKey.trim();
    }
    console.log('list instances url: ' + url);
    return this.http.get<InstanceList>(url)
      .pipe(
        map((data: InstanceList) => {
        return data;
    }, // Nothing needs to be done.
        catchError((err: Error) => {
          console.log("The list of instances could not be loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        })));
  }

  /**
   * Fetch the list of instances for a schema class.
   * @param className
   * @param skip
   * @param limit
   * @param searchKey
   * @param selectedAttributes
   * @param selectedAttributeTypes
   * @param selectedOperands
   * @param searchKeys
   * @returns
   */
  searchInstances(className: string,
                skip: number,
                limit: number,
                selectedAttributes?: string[] | undefined,
                selectedOperands?: string[] | undefined,
                searchKeys?: string[] | undefined): Observable<InstanceList> {
    let url = this.searchInstancesUrl + `${className}/` + `${skip}/` + `${limit}`;

    if (selectedAttributes !== undefined && selectedOperands !== undefined && searchKeys !== undefined){
      url += '?attributes=' + encodeURI(selectedAttributes.toString())
      + '&operands=' + encodeURI(selectedOperands.toString())
      + '&searchKeys=' + encodeURI(searchKeys.toString().replaceAll("'", "\\'"));
    }
    console.log('search instances url: ' + url);
    return this.http.get<InstanceList>(url)
      .pipe(map((data: InstanceList) => {
        return data;
    }), // Nothing needs to be done.
        catchError((err: Error) => {
          console.log("The list of instances could not be loaded: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  startLoadInstances() {
    this.loadInstanceSubject = new Subject<void>();
  }

  getLoadInstanceSubject() {
    return this.loadInstanceSubject;
  }

  stopLoadInstance() {
    this.loadInstanceSubject = undefined;
  }

  /**
   * Load the persistence instances for a user
   * @param userName
   * @returns
   */
  loadUserInstances(userName: string): Observable<UserInstances> {
    return this.http.get<UserInstances>(this.loadInstancesUrl + userName)
      .pipe(
        concatMap(userInstance => {
          // Collect all schema classes to load so that we haveefined attributes
          const classes = new Set<string>();
          userInstance.deletedInstances?.forEach(inst => classes.add(inst.schemaClassName));
          userInstance.newInstances?.forEach(inst => classes.add(inst.schemaClassName));
          userInstance.updatedInstances?.forEach(inst => classes.add(inst.schemaClassName));
          return this.fetchSchemaClasses([...classes]).pipe(map(data => {
            // Don't do anything for bookmark. We need a simple, shell instance only
            // userInstance.bookmarks?.map(inst => this.handleUserInstance(inst));
            userInstance.deletedInstances?.map(inst => this.handleUserInstance(inst));
            userInstance.newInstances?.map(inst => this.handleUserInstance(inst));
            userInstance.updatedInstances?.map(inst => this.handleUserInstance(inst));
            return userInstance;
          }));
        }),
        catchError((err: Error) => {
          console.log("Error in loadUserInstances: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
          });
          return throwError(() => err);
        }),
      );
  }

  private handleUserInstance(inst: Instance) {
    this.handleInstanceAttributes(inst);
    this.id2instance.set(inst.dbId, inst);
    // In this context, the following should return immediately even though it is
    // wrapped in an observable since we have loaded the whole schema tree already.
    // However, this may be a bug prone. Keep an eye on it!
    // Indeed, the updated instance may not be handled before it is shown.
    // Therefore, need to handle it directly without using subject
    inst.schemaClass = this.name2SchemaClass.get(inst.schemaClassName);
    // this.fetchSchemaClass(inst.schemaClassName).subscribe(schemaClass => inst.schemaClass = schemaClass);
    // Since we are using store, the actual instance used should be a clone of this one
    // to avoid be locked since instance in the store is not mutable
    // Need to make a clone to avoid locking the change
    let cloned: Instance = {
      dbId: inst.dbId,
      displayName: inst.displayName,
      schemaClassName: inst.schemaClassName,
    };
    return cloned;
  }

  /**
   * Persist new and updated instances to the server.
   * @param instances
   * @param userName
   * @returns
   */
  //TODO: See if it is possible to persist only changed attributes for updated instances to increase the
  // performance.
  persitUserInstances(userInstances: UserInstances, userName: string): Observable<any> {
    const cloned = this.cloneUserInstances(userInstances);
    return this.http.post<any>(this.persistInstancesUrl + userName, cloned).pipe(
      catchError(error => {
        console.log("An error is thrown during persistInstances: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    );
  }
  

  private cloneUserInstances(userInstances: UserInstances): UserInstances {
    const newInstances = userInstances.newInstances.map(i => this.cloneInstanceForCommit(this.id2instance.get(i.dbId)!));
    const updatedInstances = userInstances.updatedInstances.map(i => this.cloneInstanceForCommit(this.id2instance.get(i.dbId)!));
    const deletedInstances = userInstances.deletedInstances.map(i => this.cloneInstanceForCommit(this.id2instance.get(i.dbId)!));
    // There is no need to get the full instance for a bookmark
    const bookmarks = userInstances.bookmarks.map(i => this.cloneInstanceForCommit(i));
    return {
      newInstances: newInstances,
      updatedInstances: updatedInstances,
      deletedInstances: deletedInstances,
      bookmarks: bookmarks
    };
  }

  uploadCytoscapeNetwork(pathwayId: any, network: any): Observable<boolean> {
    // console.debug('Uploading cytoscape network for ' + pathwayId + "...");
    return this.http.post<boolean>(this.uploadCyNetworkUrl + pathwayId, network).pipe(
      // Since there is nothing needed to be done for the returned value (just true or false),
      // We don't need to do anything here!
      catchError(error => {
        console.log("An error is thrown during uploadCytoscapeNetwork: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    );
  }

  hasCytoscapeNetwork(pathwayId: any): Observable<boolean> {
    return this.http.get<boolean>(this.hasCyNetworkUrl + pathwayId).pipe(
      catchError(error => {
        console.log("An error is thrown during calling hasCytoscapeNetwork: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    );
  }


  getCytoscapeNetwork(pathwayId: any): Observable<any> {
    return this.http.get<any>(this.getCyNetworkUrl + pathwayId).pipe(
      catchError(error => {
        console.log("An error is thrown during getCytoscapeNetwork: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    );
  }


  /**
   * Empty the persisted instances at the server.
   * @param userName
   * @returns
   */
  deletePersistedInstances(userName: string): Observable<any> {
    return this.http.delete<any>(this.deletePersistedInstancesUrl + userName).pipe(
      catchError(error => {
        console.log("An error is thrown during deletePersistedInstances: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Find an Instance based on its display name and a list of class names.
   * @param displayName
   * @param className
   */
  findInstanceByDisplayName(displayName: string,
                            className: string[]): Observable<Instance> {
    let clsNameText = className.join(',');
    // The URL should encode itself
    let url = this.findInstanceByDisplayNameUrl + '?displayName=' + displayName + "&classNames=" + clsNameText;
    // console.debug('list instances url: ' + url);
    return this.http.get<Instance>(url)
      .pipe(map((data: Instance) => data), // Nothing needs to be done.
        catchError((err: Error) => {
          console.log("No instance can be found: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 10000
          });
          return throwError(() => err);
        }));
  }

  /**
   * Commit the passed instance back to the database.
   * @param instance
   */
  commit(instance: Instance): Observable<Instance> {
    let instanceToBeCommitted = this.cloneInstanceForCommit(instance);
    return this.http.post<Instance>(this.commitInstanceUrl, instanceToBeCommitted).pipe(
      map((inst: Instance) => inst),
      catchError(error => {
        console.log("An error is thrown during committing: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    )
  }

  /**
   * Commit the passed instance back to the database.
   * @param instance
   */
  fillReference(instance: Instance): Observable<Instance> {
    // Need to handle attributes. The map cannot be converted into JSON automatically!!!
    const copy = this.cloneInstanceForCommit(instance);
    return this.http.post<Instance>(this.fillReferenceUrl, copy).pipe(
      map((inst: Instance) => {
        console.debug('filled reference: \n', inst);
        this.handleInstanceAttributes(inst);
        return inst;
      }),
      catchError(error => {
        console.log("An error is thrown during filling LiteratureReference: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    )
  }

  private cloneInstanceForCommit(source: Instance): Instance {
    let instance: Instance = {
      dbId: source.dbId,
      displayName: source.displayName,
      schemaClassName: source.schemaClassName,
    }
    if (source.modifiedAttributes && source.modifiedAttributes.length)
      instance.modifiedAttributes = [...source.modifiedAttributes]
    // Need to manually convert the instance to a string because the use of map for attributes
    if (source.attributes && source.attributes.size) {
      let attributesJson = Object.fromEntries(source.attributes);
      instance.attributes = attributesJson;
    }
    return instance;
  }

  // TODO: Create a separate service for instance/attribute logic
  setCandidateClasses(schemaAttribute: SchemaAttribute): any[] {
    // @ts-ignore
    let concreteClassNames = new Set<string>();
    if (schemaAttribute.allowedClases) {
      for (let clsName of schemaAttribute.allowedClases) {
        let schemaClass: SchemaClass = this.getSchemaClass(clsName)!;
        this.grepConcreteClasses(schemaClass, concreteClassNames);
      }
    }
    let candidateClasses = [...concreteClassNames];
    return candidateClasses.sort();
  }

  private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
    if (!schemaClass.abstract)
      concreteClsNames.add(schemaClass.name);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        this.grepConcreteClasses(child, concreteClsNames)
      }
    }
  }

  testQACheckReport(dbId: number,
                    checkType: string,
                    editedAttributeName: string | undefined,
                    editedAttributeValue: string | undefined): Observable<string[][]> {
    return this.http.get<string[][]>(this.testQACheckReportUrl + `${dbId}`
      + "?checkType=" + checkType
      + "&editedAttributeNames=" + editedAttributeName
      + "&editedAttributeValues=" + editedAttributeValue
    )
      .pipe(map((data: string[][]) => data),
        catchError((err: Error) => {
          console.log("TestQACheck report could not be retrieved: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
          });
          return throwError(() => err);
        }),
      );
  }

  getReferrers(dbId: number): Observable<Referrer[]> {
    return this.http.get<Referrer[]>(this.getReferrersUrl  + `${dbId}`)
      .pipe(
        map((data: Referrer[]) => {
          console.log(data);
            return data;
          }, // Nothing needs to be done.
          catchError((err: Error) => {
            console.log("The list of instances could not be loaded: \n" + err.message, "Close", {
              panelClass: ['warning-snackbar'],
              duration: 10000
            });
            return throwError(() => err);
          })));
  }


  /**
   * Delete an instance in the database.
   * @param instance
   */
  delete(instance: Instance): Observable<boolean> {
    let instanceToBeDeleted = this.cloneInstanceForCommit(instance);
    return this.http.post<boolean>(this.deleteSimpleInstance, instance).pipe(
      catchError(error => {
        console.log("An error is thrown during deleting: \n" + error.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 10000
        });
        return throwError(() => error);
      })
    )
  }

}
