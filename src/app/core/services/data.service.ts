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
import { QAReport } from "../models/qa-report.model";


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
  private fetchQAReportUrl = `${environment.ApiRoot}/qaReport/`;
  private fetchInstancesInBatchUrl = `${environment.ApiRoot}/findByDbIds/`;
  private fetchPathwayDiagramUrl = `${environment.ApiRoot}/fetchPathwayDiagramForPathway/`;
  private deleteByDeletedUrl = `${environment.ApiRoot}/deleteByDeleted/`;


  // Track the negative dbId to be used
  private nextNewDbId: number = -1;
  // The root class is cached for performance
  private rootClass: SchemaClass | undefined;
  private rootEvent: Instance | undefined;

  // Use this subject to force waiting for components to fetch instance
  // since we need to load changed instances from cached storage first
  private loadInstanceSubject: Subject<void> | undefined = undefined;

  // Notify when there is an error due to failed api
  private errorMessage = new Subject<Error>();
  errorMessage$ = this.errorMessage.asObservable();
  componentRefreshSubject: any;

  constructor(private http: HttpClient,
    private utils: InstanceUtilities,
    private store: Store,
  ) {
  }

  /**
   * Initialize the DataService by loading schema classes.
   * This method is designed to be used with APP_INITIALIZER to ensure
   * schema classes are loaded before the app starts.
   */
  initialize(): Promise<void> {
    console.debug('Initializing DataService - loading schema classes...');

    return new Promise((resolve, reject) => {
      this.fetchSchemaClassTree().subscribe({
        next: (rootSchemaClass) => {
          console.debug('Schema class tree loaded successfully during initialization:', rootSchemaClass.name);
          // Schema classes are automatically cached in the dataService
          resolve();
        },
        error: (error) => {
          console.error('Failed to load schema classes during initialization:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Check if schema classes have been loaded
   */
  isSchemaClassesLoaded(): boolean {
    return this.rootClass !== undefined;
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
  getSchemaClass(clsName: string): SchemaClass {
    // Ensure simple-class map is built if we have the root
    if ((!this.name2SimpleClass || this.name2SimpleClass.size === 0) && this.rootClass) {
      this.buildSchemaClassMap(this.rootClass, this.name2SimpleClass);
    } else if (!this.rootClass && (!this.name2SimpleClass || this.name2SimpleClass.size === 0)) {
      console.warn("Schema class map is empty and rootClass is not loaded. Returning a fallback SchemaClass for:", clsName);
    }

    const found = this.name2SimpleClass.get(clsName);
    if (found) return found;

    // Create a minimal fallback SchemaClass so callers never receive undefined.
    const fallback: SchemaClass = {
      name: clsName,
      children: [],
      abstract: false
    } as SchemaClass;

    // Cache the fallback to avoid creating it repeatedly
    this.name2SimpleClass.set(clsName, fallback);
    return fallback;
  }

  private buildSchemaClassMap(schemaClass: SchemaClass, name2schemaclass: Map<string, SchemaClass>) {
    name2schemaclass.set(schemaClass.name, schemaClass);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        child.parent = schemaClass; // Set parent link
        this.buildSchemaClassMap(child, name2schemaclass);
      }
    }
  }

  isEventClass(clsName: string): boolean {
    let schemaClass = this.getSchemaClass('Event');
    return this.utils._isSchemaClass(clsName, schemaClass);
  }

  isPhysicalEntityClass(clsName: string): boolean {
    let schemaClass = this.getSchemaClass('PhysicalEntity');
    return this.utils._isSchemaClass(clsName, schemaClass);
  }

  /**
   * A helper function to convert a JSON array into a SchemaClass so that it is easier to model.
   * @param data
   */
  private convertToSchemaClass(clsName: string, data: any): SchemaClass {
    return this.utils.convertToSchemaClass(clsName, data);
  }

  /**
   * Fetch the PathwayDiagram for a given pathway based on its dbId.
   * @param pathwayId
   * @returns 
   */
  fetchPathwayDiagram(pathwayId: any): Observable<Instance> {
    return this.http.get<Instance>(this.fetchPathwayDiagramUrl + `${pathwayId}`)
      .pipe(map((data: Instance) => data), // Nothing needs to be done.
        catchError((err: Error) => {
          return this.handleErrorMessage(err);
        }));
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
    return rtn;
  }

  /**
   * Fetch a list of intances for the provided dbIds list.
   * @param dbIds 
   */
  fetchInstances(dbIds: number[]): Observable<Instance[]> {
    if (!dbIds) return of([]); // Return an empty array if dbIds is undefined or null
    const observables: Observable<Instance>[] = dbIds.map((dbId: number) => this.fetchInstance(dbId));
    return forkJoin(observables);
  }

  /**
   * Fetch the reaction with all participants so that it can be laid out in a
   * pathway diagram.
   * Note: the attributes here don't follow the schema definition of ReactionLikeEvent.
   * We don't ask the server to provide participants since some of paricipants may be updated
   * locally but not committed to the server. Therfore, we need to fetch the participants separately
   * based on the loaded reaction.
   * TODO: There are multiple rounds of load instances here and inside instance.services.ts. We need to
   * optimize by loading reaction participants from the server still.
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
        const helpersList = [...helperDbIds];
        if (helpersList.length === 0) {
          // If no helpers to fetch, proceed directly to the next step
          const additionalDbIds = this.utils.grepReactomeParticipantIds(inst);
          if (additionalDbIds.length === 0)
            return of(inst);
          return this.fetchInstances(additionalDbIds).pipe(
            concatMap((pes: Instance[]) => {
              return this.utils.fillRenderInfoForReactionParticipants(inst, pes, this).pipe(
                map(() => inst)
              );
            })
          );
        }
        return this.fetchInstances(helpersList).pipe(
          concatMap((helpers: Instance[]) => {
            this.utils.addHelpersToReaction(inst, helpers);
            // Add another fetchInstances call here to make sure each PE
            // has its refSchemaClass and hasModifiedResidue filled.
            const additionalDbIds = this.utils.grepReactomeParticipantIds(inst);
            // Populate additionalDbIds based on your logic
            if (additionalDbIds.length === 0)
              return of(inst);
            return this.fetchInstances(additionalDbIds).pipe(
              concatMap((pes: Instance[]) => {
                return this.utils.fillRenderInfoForReactionParticipants(inst, pes, this).pipe(
                  map(() => inst)
                );
              })
            );
          })
        );
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
  cloneInstance(instance: Instance): Observable < Instance > {
      return this.createNewInstance(instance.schemaClassName).pipe(
        concatMap((newInst: Instance) => {
          return this.fetchInstance(instance.dbId).pipe(
            map((inst: Instance) => {
              const uneditableAtts: Array<string> = this.getAttributeNamesNotClonable();
              const allAttributes: Map<string, any> = inst.attributes;

              for (let attribute of newInst.schemaClass!.attributes!) {
                if (attribute.category === AttributeCategory.NOMANUALEDIT) {
                  continue;
                }
                if (uneditableAtts.includes(attribute.name)) {
                  continue;
                }
                let value = allAttributes.get(attribute.name);
                if (!value) continue

                // Clone the value if it's an array to prevent mutation issues
                if (Array.isArray(value)) {
                  value = [...value];
                }
                newInst.attributes.set(attribute.name, value);
              }
              // Set displayName last
              newInst.attributes.set('displayName', 'Clone of ' + instance.displayName);
              newInst.displayName = 'Clone of ' + instance.displayName;
              return newInst;
            }),
            catchError((err: Error) => {
              return this.handleErrorMessage(err);
            })
          );
        })
      );
    }

  private getAttributeNamesNotClonable(): Array < string > {
      return ['authored', 'edited', 'reviewed', 'revised', '_doRelease', 'releaseStatus', 'releaseDate', 'doi']
    }

  /**
   * Register a new instance to the cache.
   */
  registerInstance(instance: Instance): void {
      // Make sure map is used
      if(instance.attributes && !(instance.attributes instanceof Map)) {
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

    // Load schema tree first to ensure name2SchemaClass map is populated
    return this.fetchSchemaClassTree(false).pipe(
      concatMap(() => {
        // Use cached class directly instead of fetchSchemaClass
        let schemaClass = this.name2SchemaClass.get(className);
        if (!schemaClass) {
          // Fallback: fetch individually if not found in cache
          return this.fetchSchemaClass(className).pipe(
            map((fetchedSchemaClass: SchemaClass) => {
              instance.schemaClass = fetchedSchemaClass;
              return instance;
            })
          );
        }

        // Use cached schema class directly
        instance.schemaClass = schemaClass;
        return of(instance);
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
      //Error handling
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
            // Don't cache the deleted instances since they are just shell instances
            // We need to load the attributes from the database
            userInstance.deletedInstances?.map(inst => this.handleUserInstance(inst, false));
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

  private handleUserInstance(inst: Instance, cached: boolean = true): Instance {
    this.handleInstanceAttributes(inst);
    if (cached)
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

  uploadCytoscapeNetwork(pathwayDiagramId: any, network: any): Observable<boolean> {
    // console.debug('Uploading cytoscape network for ' + pathwayDiagramId + ": ", network);
    return this.http.post<boolean>(this.uploadCyNetworkUrl + pathwayDiagramId, network).pipe(
      // tap(() => {
      //   console.debug('Cytoscape network for ' + pathwayDiagramId + ' uploaded.');
      // }),
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
   * A method to handle queing commits.
   * @param instances
   */
  /**
   * Commit a batch of instances, ensuring that instances with edited referrers are included.
   * Returns an Observable of the instances that should be committed together.
   */
  /**
   * Commit a batch of instances, excluding those that have a referrer in the batch.
   * Only top-level (parent) instances are returned for commit, as they will handle their children.
   */
  commitNewInstsInBatch(instances: Instance[]): Observable<Instance[]> {
    if (!instances || instances.length === 0) return of([]);

    const batchDbIds = new Set(instances.map(i => i.dbId));
    const referredDbIds = new Set<number>();


    instances.forEach(inst => {
      if (referredDbIds.has(inst.dbId)) return;

      if (!inst.attributes) return;
      // Use proper Map iteration signature to ensure both keyed and unkeyed maps are handled
      batchDbIds.forEach(batchDbId => {
        if (this.utils.isReferrer(inst.dbId, this.id2instance.get(batchDbId)!)) {
          referredDbIds.add(inst.dbId);
        }
      });
    });

    // Return instances with referred ones removed (preserve original order)
    const result = instances.filter(i => !referredDbIds.has(i.dbId));
    return of(result);
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
    // To avoid changing the code here
    instance = cached
    const checked = new Set<number>();
    instance = this.fillAttributesForCommit(instance, checked);
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
  private fillAttributesForCommit(inst: Instance, checked: Set<number>): Instance {
    if (checked.has(inst.dbId))
      return inst;
    checked.add(inst.dbId);
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
            this.fillAttributesForCommit(valueInst, checked);
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
                this.fillAttributesForCommit(valueInst, checked);
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
        if (schemaClass) {
          // ensure grepConcreteClasses runs synchronously before proceeding
          this.grepConcreteClasses(schemaClass, concreteClassNames);
        } else {
          // fallback: try to get a simple class mapping (might be available if tree was built)
          const fallback = this.getSchemaClass(clsName);
          if (fallback) {
            this.grepConcreteClasses(fallback, concreteClassNames);
          } else {
            console.warn(`Schema class "${clsName}" is not loaded; skipping concrete-class collection.`);
          }
        }
      }
    }
    let candidateClasses = [...concreteClassNames];
    return candidateClasses.sort();
  }

  // Was private, changed to public for testing purposes. This method is recursive and will populate the provided set with the names of all concrete classes in the subtree rooted at schemaClass.
  grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
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
    // In case is from store, which is immutable
    let instanceToBeCommitted = this.utils.cloneInstanceForCommit(instance);
    // Need to add default person id for this instance
    return this.store.select(defaultPerson()).pipe(
      take(1),
      concatMap((person: Instance[]) => {
        if (!person || person.length == 0) {
          return this.handleErrorMessage(new Error('Cannot find the default person!'));
        }
        instanceToBeCommitted.defaultPersonId = person[0].dbId;
        return this.http.post<boolean>(this.deleteInstaneUrl, instanceToBeCommitted).pipe(
          map((data: boolean) => data),
          catchError(error => {
            return this.handleErrorMessage(error);
          })
        );
      }));
  }

  /**
  * Delete one or more than one instances by parsing the Deleted object from the front end.
  * @param instance
  * @return
  */
  deleteByDeleted(deleted: Instance): Observable<boolean> {
    let deletedToBeCommitted = this.utils.cloneInstanceForCommit(deleted);
    // Need to add default person id for this instance
    return this.store.select(defaultPerson()).pipe(
      take(1),
      concatMap((person: Instance[]) => {
        if (!person || person.length == 0) {
          return this.handleErrorMessage(new Error('Cannot find the default person!'));
        }
        deletedToBeCommitted.defaultPersonId = person[0].dbId;
        return this.http.post<boolean>(this.deleteByDeletedUrl, deletedToBeCommitted).pipe(
          map((data: boolean) => data),
          catchError(error => {
            return this.handleErrorMessage(error);
          })
        );
      }));
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

  /**
   * Get local referrers for a given dbId.
   * @param dbId
   * @param referrers
   */

  /**
   * Get local referrers for a given dbId, merging with store-updated/new instances,
   * and filtering out deleted instances.
   */
  _getReferrers(dbId: number, referrers: Referrer[]): Observable<Referrer[]> {
    const attributeNames = new Set<string>(referrers?.map(ref => ref.attributeName));

    return combineLatest([
      this.store.select(updatedInstances()).pipe(take(1)),
      this.store.select(newInstances()).pipe(take(1)),
      this.store.select(deleteInstances()).pipe(take(1))
    ]).pipe(
      map(([updated, created, deleted]) => {
        const deletedDBIds = new Set(deleted.map(inst => inst.dbId));
        const candidateDBIds = [
          ...updated.map(inst => inst.dbId),
          ...created.map(inst => inst.dbId)
        ];

        // Remove deleted and candidate instances from referrers
        referrers = this.filterDeletedReferrers(referrers, deletedDBIds);
        referrers = referrers.map(ref => ({
          ...ref,
          referrers: ref.referrers.filter(inst => !candidateDBIds.includes(inst.dbId))
        })).filter(ref => ref.referrers.length > 0);

        // Add local referrers from updated/new instances
        candidateDBIds.forEach(id => {
          const inst = this.id2instance.get(id);
          if (!inst || !inst.attributes) return;
          inst.attributes.forEach((value: any, att: string) => {
            if (Array.isArray(value)) {
              value.forEach(v => {
                if (v?.dbId === dbId) this.addReferrer(referrers, attributeNames, att, inst);
              });
            } else if (value?.dbId === dbId) {
              this.addReferrer(referrers, attributeNames, att, inst);
            }
          });
        });

        return referrers;
      })
    );
  }

  private addReferrer(referrers: Referrer[], attributeNames: Set<string>, attribute: string, inst: Instance) {
    let ref = referrers.find(r => r.attributeName === attribute);
    if (ref) {
      if (!ref.referrers.some(i => i.dbId === inst.dbId)) ref.referrers.push(inst);
    } else {
      referrers.push({ attributeName: attribute, referrers: [inst] });
      attributeNames.add(attribute);
    }
  }

  private filterDeletedReferrers(referrers: Referrer[], deletedDBIds: Set<number>): Referrer[] {
    return referrers
      .map(ref => ({
        ...ref,
        referrers: ref.referrers.filter(inst => !deletedDBIds.has(inst.dbId))
      }))
      .filter(ref => ref.referrers.length > 0); // Remove referrers with no remaining instances
  }

  isSchemaClass(instance: Instance, className: string): boolean {
    let schemaClass = this.getSchemaClass(className);
    if (instance.schemaClassName === undefined)
      return false

    else
      return this.utils._isSchemaClass(instance.schemaClassName, schemaClass!);
  }

  handleErrorMessage(err: Error) {
    console.log("The resource could not be loaded: \n" + err.message);
    this.errorMessage.next(err);
    return throwError(() => err);
  };

  /**
  * Pass the instance to the back end for QA checks.
  * @param instance
  */
  fetchQAReport(instance: Instance): Observable<QAReport> {
    // In case instance is just a shell, we need to use the cached instance
    return this.http.post<QAReport>(this.fetchQAReportUrl, instance).pipe(
      map((report: QAReport) => {
        //   for(let result of report.qaResults) {
        //     this.doubleArrayToDataSource(result.rows, result.columns)
        // }
        return report;
      }),
      catchError(error => {
        return this.handleErrorMessage(error);
      })
    );
  }

  doubleArrayToDataSource(data: any[][], columnNames: string[]): any[] {
    return data.map(innerArray => {
      const obj: any = {};
      innerArray.forEach((value, index) => {
        obj[columnNames[index]] = value;
        if (value.includes("SimpleInstance")) {
          value = value.replace("SimpleInstance ", "");
          value = JSON.parse(value) as Instance
        }
      });
      return obj;
    });
  }

  fetchInstanceInBatch(dbIds: number[]): Observable<Instance[]> {
    if (dbIds.length === 0) {
      return of([]);
    }

    const fromCache: { [key: number]: Instance } = {};
    const toFetch: number[] = [];

    dbIds.forEach(id => {
      if (this.id2instance.has(id)) {
        fromCache[id] = this.id2instance.get(id)!;
      } else {
        toFetch.push(id);
      }
    });

    if (toFetch.length === 0) {
      // All instances are in the cache
      return of(dbIds.map(id => fromCache[id]));
    }

    // Fetch the rest from the backend
    return this.http.post<Instance[]>(this.fetchInstancesInBatchUrl, toFetch).pipe(
      map((fetched: Instance[]) => {
        fetched.forEach(inst => {
          this.handleInstanceAttributes(inst);
          this.id2instance.set(inst.dbId, inst);
        });
        const fetchedMap = new Map(fetched.map(inst => [inst.dbId, inst]));
        // Merge, preserving original order
        return dbIds.map(id => fromCache[id] || fetchedMap.get(id)!);
      }),
      catchError((err: Error) => this.handleErrorMessage(err))
    );
  }

}