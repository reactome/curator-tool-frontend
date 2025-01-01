import { HttpClient } from "@angular/common/http";
import { Injectable } from '@angular/core';
import { Store } from "@ngrx/store";
import { catchError, combineLatest, concatMap, forkJoin, map, Observable, of, Subject, take, throwError } from 'rxjs';
import { defaultPerson, deleteInstances, newInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { environment } from 'src/environments/environment.dev';
import { Instance, InstanceList, NEW_DISPLAY_NAME, Referrer, UserInstances } from "../models/reactome-instance.model";
import {
  AttributeCategory,
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
  // This map is used to make schema class traversal easy. The SchemaClass in this map
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
  private deleteInstaneUrl = `${environment.ApiRoot}/delete/`;


  // Track the negative dbId to be used
  private nextNewDbId: number = -1;
  // The root class is cached for performance
  private rootClass: SchemaClass | undefined;
  private rootEvent: Instance | undefined;

  // Use this subject to force waiting for components to fetch instance
  // since we need to load changed instances from cached storage first
  private loadInstanceSubject: Subject<void> | undefined = undefined;
  newInstances: unknown;

  // Notify when there is an error due to failed api
  private errorMessage = new Subject<Error>();
  errorMessage$ = this.errorMessage.asObservable();

  constructor(private http: HttpClient,
    private utils: InstanceUtilities,
    private store: Store,
  ) {
  }

  /**
   * Call this method will reset the cached schema tree so that the schema tree will be reloaded
   * when needed. This is useful when a new instance or a deletion is committed so that the counts
   * of classes can be updated. Call this method will not call the http method to the server.
   */
  flagSchemaTreeForReload() {
    this.rootClass = undefined;
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
          return this.handleErrorMessage(err);
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
          return this.handleErrorMessage(err);
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
            attributes: { "hasEvent": data }
          };
          this.utils.mergeLocalChangesToEventTree(rootEvent, this.id2instance);
          this.rootEvent = rootEvent;
          return rootEvent;
        }),
        catchError((err: Error) => {
          return this.handleErrorMessage(err);
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
    let rtn: Observable<Instance>;
    // Check cached results first
    if (this.id2instance.has(dbId)) {
      rtn = of(this.id2instance.get(dbId)!);
    }
    else {
      rtn = this.fetchInstanceFromDatabase(dbId, true);
    }
    // Need to apply deletion after loading from the database. But not
    // in the loading. Otherwise, we will never get the original datbase copy.
    return rtn.pipe(
      concatMap(instance =>
        this.store.select(deleteInstances()).pipe(
          take(1),
          map(deletedInsts => {
            this.utils.applyLocalDeletions(instance, deletedInsts);
            return instance;
          })
        )
      ),
      concatMap(instance =>
        this.store.select(updatedInstances()).pipe(
          take(1),
          map(updatedInsts => {
            this.utils.validateReferDisplayName(instance, updatedInsts);
            return instance;
          })
        )
      )
    );
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
    return this.fetchInstance(dbId).pipe(
      concatMap((inst: Instance) => {
        const helperDbIds = new Set<number>();
        if (inst.attributes) {
          const atts = [
            'catalystActivity',
            'regulatedBy'
          ];
          for (let att of atts) {
            if (!inst.attributes.get(att))
              continue;
            for (let attValue of inst.attributes.get(att)) {
              // Just in case
              if (attValue.dbId)
                helperDbIds.add(attValue.dbId);
            }
          }
        }
        if (helperDbIds.size === 0)
          return of(inst);
        // Need to do another around to fetch helper nodes
        return this.fetchInstances([...helperDbIds]).pipe(map((helpers: Instance[]) => {
          this.utils.addHelpersToReaction(inst, helpers);
          return inst;
        }));
      })
    );
  }

  fetchInstanceFromDatabase(dbId: number, cache: boolean): Observable<Instance> {
    // Fetch from the server
    return this.http.get<Instance>(this.entityDataUrl + `${dbId}`)
      .pipe(
        map((data: Instance) => {
          let instance: Instance = data; // Converted into the Instance object already
          this.handleInstanceAttributes(instance);
          if (cache)
            this.id2instance.set(dbId, instance); // Cache this instance
          return instance;
        }),

        catchError((err: Error) => {
          return this.handleErrorMessage(err);
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
        return this.handleErrorMessage(err);
      }),
    );
  }

    /**
   * Create a new instance from an existing instance.
   */
  cloneInstance(instance: Instance): Observable<Instance> {
    let newInstance: Instance;
    this.createNewInstance(instance.schemaClassName).subscribe((newInst: Instance) => {
      newInstance = newInst;
    });
    return this.fetchInstance(instance.dbId).pipe(map((inst: Instance) => {
      let uneditableAtts: Array<string> = this.getAttributeNamesNotClonable();
      let allAttributes: Map<string, any> = inst.attributes;
      for(let attribute of newInstance.schemaClass!.attributes!){
        if(attribute.category === AttributeCategory.NOMANUALEDIT){
          continue;
        }
          if(uneditableAtts.includes(attribute.name)) {
            continue;
          }
            newInstance.attributes.set(attribute.name, allAttributes.get(attribute.name));
        
      }
      // Set displayName last
      newInstance.attributes.set('displayName', 'Clone of ' + instance.displayName);
      newInstance.displayName = 'Clone of ' + instance.displayName;
      return newInstance;
    }),
      catchError((err: Error) => {
        return this.handleErrorMessage(err);
      }),
    );
  }

  getAttributeNamesNotClonable(): Array<string> {
    return ['authored', 'edited', 'reviewed', 'revised', '_doRelease', 'releaseStatus', 'releaseDate', 'doi']
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

  removeInstanceInCache(dbId: number): void {
    if (this.id2instance.has(dbId))
      this.id2instance.delete(dbId);
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
    if (searchKey)
      searchKey = searchKey.trim(); // Just to make sure no space there
    if (searchKey && searchKey.length > 0) {
      url += '?query=' + searchKey;
    }
    return this.http.get<InstanceList>(url).pipe(
      // First concatMap: Fetch schema class hierarchy
      concatMap((data: InstanceList) => {
        // Make sure schema class hierarchy is loaded so that we can use isSchemaClass
        return this.fetchSchemaClassTree(false).pipe(
          map(rootClass => {
            // Return original data so that it can be used in the next steps
            return data;
          })
        );
      }),
      // Second concatMap: First select subscription (newInstances)
      concatMap((data: InstanceList) => {
        return this.store.select(newInstances()).pipe(
          take(1),
          map((insts) => {
            for (let inst of insts) {
              inst = this.utils.makeShell(inst);
              // This should be faster therefore check it first
              if (searchKey && searchKey.length > 0) {
                // If searchKey is integer, check for dbId
                if (/^\d+$/.test(searchKey)) {
                  if (inst.dbId.toString() !== searchKey)
                    continue;
                }
                // Otherwise, check for text
                else if (!inst.displayName?.toLocaleLowerCase().includes(searchKey.toLocaleLowerCase()))
                  continue;
              }
              // The skip should be less than the limit to ensure new instances are only added to the first page.
              if (this.isSchemaClass(inst, className) && (skip < limit)) {
                // Update the data being returned. New instance is placed at index 0.
                data.instances.splice(0, 0, inst);
                data.totalCount++;
              }
            }
            return data; // Pass modified data to the next step
          })
        );
      }),
      // Third concatMap: Second select subscription (deleteInstances)
      concatMap((data: InstanceList) => {
        return this.store.select(deleteInstances()).pipe(
          take(1),
          map((instances) => {
            const deletedDBIds = instances.map(inst => inst.dbId);
            for (let i = 0; i < data.instances.length; i++) {
              if (deletedDBIds.includes(data.instances[i].dbId)) {
                data.instances.splice(i, 1);
                i--; // Adjust index after removal
                data.totalCount--;
              }
            }
            return data; // Pass the final modified data
          })
        );
      }),
      // Error handling
      catchError((err: Error) => {
        return this.handleErrorMessage(err);
      })
    );
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

    if (selectedAttributes !== undefined && selectedOperands !== undefined && searchKeys !== undefined) {
      url += '?attributes=' + encodeURI(selectedAttributes.toString())
        + '&operands=' + encodeURI(selectedOperands.toString())
        + '&searchKeys=' + encodeURI(searchKeys.toString().replaceAll("'", "\\'"));
    }
    console.debug('search instances url: ' + url);
    return this.http.get<InstanceList>(url)
      .pipe(map((data: InstanceList) => {
        return data;
      }), // Nothing needs to be done.
        catchError((err: Error) => {
          return this.handleErrorMessage(err);
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
          if (classes.size == 0)
            return of(userInstance);
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
          return this.handleErrorMessage(err);
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
        return this.handleErrorMessage(error);
      })
    );
  }


  private cloneUserInstances(userInstances: UserInstances): UserInstances {
    const newInstances = userInstances.newInstances.map(i => this.utils.cloneInstanceForCommit(this.id2instance.get(i.dbId)!));
    const updatedInstances = userInstances.updatedInstances.map(i => this.utils.cloneInstanceForCommit(this.id2instance.get(i.dbId)!));
    const deletedInstances = userInstances.deletedInstances.map(i => this.utils.makeShell(i));
    // There is no need to get the full instance for a bookmark
    const bookmarks = userInstances.bookmarks.map(i => this.utils.cloneInstanceForCommit(i));
    const clone: UserInstances =
    {
      newInstances: newInstances,
      updatedInstances: updatedInstances,
      deletedInstances: deletedInstances,
      bookmarks: bookmarks
    };
    if (userInstances.defaultPerson) {
      clone.defaultPerson = this.utils.makeShell(userInstances.defaultPerson);
    }
    return clone;
  }

  uploadCytoscapeNetwork(pathwayId: any, network: any): Observable<boolean> {
    // console.debug('Uploading cytoscape network for ' + pathwayId + "...");
    return this.http.post<boolean>(this.uploadCyNetworkUrl + pathwayId, network).pipe(
      // Since there is nothing needed to be done for the returned value (just true or false),
      // We don't need to do anything here!
      catchError(error => {
        return this.handleErrorMessage(error);
      })
    );
  }

  hasCytoscapeNetwork(pathwayId: any): Observable<boolean> {
    return this.http.get<boolean>(this.hasCyNetworkUrl + pathwayId).pipe(
      catchError(error => {
        return this.handleErrorMessage(error);
      })
    );
  }


  getCytoscapeNetwork(pathwayId: any): Observable<any> {
    return this.http.get<any>(this.getCyNetworkUrl + pathwayId).pipe(
      catchError(error => {
        return this.handleErrorMessage(error);
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
        return this.handleErrorMessage(error);
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
          return this.handleErrorMessage(err);
        }));
  }

  /**
   * Commit the passed instance back to the database.
   * @param instance
   */
  commit(instance: Instance): Observable<Instance> {
    // In case instance is just a shell, we need to use the cached instance
    // which should be the full instance
    const cached = this.id2instance.get(instance.dbId);
    if (!cached) {
      return this.handleErrorMessage(new Error('Cannot find the instance to commit!'));
    } 
    // To avoid chaning the code here
    instance = cached
    instance = this.fillAttributesForCommit(instance);
    let instanceToBeCommitted = this.utils.cloneInstanceForCommit(instance);
    // Need to add default person id for this instance
    return this.store.select(defaultPerson()).pipe(
      take(1),
      concatMap((person: Instance[]) => {
        if (!person || person.length == 0) {
          return this.handleErrorMessage(new Error('Cannot find the default person!'));
        }
        instanceToBeCommitted.defaultPersonId = person[0].dbId;
        return this.http.post<Instance>(this.commitInstanceUrl, instanceToBeCommitted).pipe(
          map((inst: Instance) => {
            // Remove the original instance from the cache
            // This should work for both new and updated instances
            this.removeInstanceInCache(instance.dbId);
            return inst;
          }),
          catchError(error => {
            return this.handleErrorMessage(error);
          })
        );
      })
    );
  }

  /**
   * Fill the attributes with new Instances so that they can be committed automatically.
   * @param inst 
   * @returns 
   */
  private fillAttributesForCommit(inst: Instance): Instance {
    if (inst.attributes) {
      inst.attributes.forEach((value: any, key: string) => {
        if (!value) return;
        // Use to check if this is an object
        if (this.utils.isInstance(value)) {
          let valueInst: Instance = value as Instance;
          if (valueInst.dbId < 0) {
            valueInst = this.id2instance.get(valueInst.dbId)!;
            inst.attributes.set(key, valueInst);
            // Make a recursive call for all new instances
            this.fillAttributesForCommit(valueInst);
          }
        }
        else if (Array.isArray(value)) {
          if (value.length > 0 && this.utils.isInstance(value[0])) {
            for (let i = 0; i < value.length; i++) {
              let valueInst: Instance = value[i] as Instance;
              if (valueInst.dbId < 0) {
                valueInst = this.id2instance.get(valueInst.dbId)!;
                value[i] = valueInst;
                // Make a recursive call for all new instances
                this.fillAttributesForCommit(valueInst);
              }
            }
          }
        }
      });
    }
    return inst;
  }

  /**
   * Commit the passed instance back to the database.
   * @param instance
   */
  fillReference(instance: Instance): Observable<Instance> {
    // Need to handle attributes. The map cannot be converted into JSON automatically!!!
    const copy = this.utils.cloneInstanceForCommit(instance);
    return this.http.post<Instance>(this.fillReferenceUrl, copy).pipe(
      map((inst: Instance) => {
        console.debug('filled reference: \n', inst);
        this.handleInstanceAttributes(inst);
        return inst;
      }),
      catchError(error => {
        return this.handleErrorMessage(error);
      })
    )
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
          return this.handleErrorMessage(err);
        }),
      );
  }

  /**
 * Delete an instance in the database.
 * @param instance
 */
  delete(instance: Instance): Observable<boolean> {
    return this.http.post<boolean>(this.deleteInstaneUrl, instance).pipe(
      catchError(error => {
        return this.handleErrorMessage(error);
      })
    )
  }

  /**
   * To avoid calling the backend for new instances we need to check the dbId
   * @param dbId
   */
  getReferrers(dbId: number): Observable<Referrer[]> {
    let referrers: Referrer[] = [];
    if (dbId > 0) {
      return this.http.get<Referrer[]>(this.getReferrersUrl + `${dbId}`).pipe(
        concatMap((data: Referrer[]) => {
          return this._getReferrers(dbId, data);
        }),
          // Nothing needs to be done.
          catchError((err: Error) => {
            return this.handleErrorMessage(err);
          }));
    }
    return this._getReferrers(dbId, referrers);
  }

  _getReferrers(dbId: number, referrers: Referrer[]): Observable<Referrer[]> {
    // Checking the store for new and updated instances
    let attributeNames: string[] = referrers?.map((ref) => ref.attributeName);
    combineLatest([this.store.select(updatedInstances()).pipe(take(1)), this.store.select(newInstances()).pipe(take(1))])
      .subscribe(([updatedInstances, newInstances]) => {
        const dbIds = updatedInstances.map(inst => inst.dbId);
        newInstances.map(inst => dbIds.push(inst.dbId));
        this.fetchInstances(dbIds).subscribe(insts => {
          for (let inst of insts) {
            if (!inst.modifiedAttributes)
              continue;
            // Only need to check the modified attributes for edits
            for (let attribute of inst.modifiedAttributes!) {
              let attributeData = inst.attributes.get(attribute)
              if (!attributeData)
                continue;
              if (Array.isArray(attributeData)) {
                for (let attData of attributeData) {
                  // Check that the attribute is an Object with the correct dbId
                  if (attData.dbId && attData.dbId === dbId) {
                    // The Reference type is used to hold the attribute name and instance,
                    // the getReferrers method will map to the correct array. 
                    let ref: Referrer = { attributeName: attribute, referrers: [inst] }
                    // If the Reference List contains this attribute, add the instance to the array
                    if (attributeNames && attributeNames.includes(ref.attributeName)) {
                      let index = attributeNames.indexOf(ref.attributeName);
                      attributeNames.push(ref.attributeName);
                      referrers.at(index)?.referrers.push(ref.referrers.at(0)!);
                    }
                    // Otherwise create new reference type
                    else {
                      if (attributeNames)
                        attributeNames.push(ref.attributeName);
                      referrers.push(ref);
                    }
                  }
                }
              }
              else {
                if (attributeData.dbId && attributeData.dbId === dbId) {
                  let ref: Referrer = { attributeName: attribute, referrers: [inst] }
                  // If the Reference List contains this attribute, add the instance to the array
                  if (attributeNames?.includes(ref.attributeName)) {
                    let index = attributeNames.indexOf(ref.attributeName);
                    attributeNames.push(ref.attributeName);
                    referrers.at(index)?.referrers.push(ref.referrers.at(0)!);
                  }
                  // Otherwise create new reference type
                  else {
                    attributeNames?.push(ref.attributeName);
                    //referrers.forEach(refs => { refs.push(ref) });
                    referrers.push(ref);
                  }
                }
              }
            }

          }
        });
      })
    return of(referrers);
  }

  isSchemaClass(instance: Instance, className: string): boolean {
    let schemaClass = this.getSchemaClass(className);
    return this.utils._isSchemaClass(instance, schemaClass!);
  }

  handleErrorMessage(err: Error) {
    console.log("The resource could not be loaded: \n" + err.message);
    this.errorMessage.next(err);
    return throwError(() => err);
  };
}
