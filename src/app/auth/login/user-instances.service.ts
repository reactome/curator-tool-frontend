import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { combineLatest, defaultIfEmpty, finalize, forkJoin, of, take } from "rxjs";
import { catchError } from "rxjs/operators";
import { Instance, UserInstances } from "src/app/core/models/reactome-instance.model";
import { AuthenticateService } from "src/app/core/services/authenticate.service";
import { DataService } from "src/app/core/services/data.service";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { DefaultPersonActions, DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { defaultPerson, deleteInstances, newInstances, updatedInstances, updatedInstanceState } from "src/app/instance/state/instance.selectors";
import { BookmarkActions } from "src/app/schema-view/instance-bookmark/state/bookmark.actions";
import { bookmarkedInstances } from "src/app/schema-view/instance-bookmark/state/bookmark.selectors";
import { PathwayDiagramObjectActions } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.actions";
import { pathwayDiagramObjects } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.selectors";
import { PathwayDiagramObject } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.model";

/**
 * Group a set of utility methods here for easy access to all other classes.
 */
@Injectable({
    providedIn: 'root'
})
export class UserInstancesService {

    constructor(private instUtils: InstanceUtilities,
        private dataService: DataService,
        private authService: AuthenticateService,
        private store: Store) {
    }

    // TODO: This may use the same pattern as being used to load schema tree by using APP_INITIALIZER
    loadUserInstances() {
        // Before we do anything, load the persisted instances if any
        console.debug('App loading instances from server...');
        const user = this.authService.getUser();
        if (!user) {
            console.debug('Cannot find a user to loadUserInstances');
            return;
        }
        // TODO: Make sure this is updated during deployment
        this.dataService.startLoadInstances();
        this.dataService.loadUserInstances(user).pipe(
            // Use this so that checkLocalStorage will be called always even though userInstances is empty
            defaultIfEmpty({ newInstances: [], updatedInstances: [], deletedInstances: [], bookmarks: [], defaultPerson: undefined }), // Emit default if nothing is returned
            finalize(() => {
                // These statements will always run regardless of what happens inside
                // The following two statements will force the dataService to finish the loading first
                this.dataService.getLoadInstanceSubject()!.next();
                this.dataService.getLoadInstanceSubject()!.complete();
                this.dataService.stopLoadInstance();
                // Call this in case there are existing dbId
                this.dataService.resetNextNewDbId();
            })
        ).subscribe((userInstances: UserInstances) => {
            // console.debug(userInstance);
            // Instances have been cloned at dataService
            // To be pulled out so that there is no need to call the server when the status is pushed
            // in the localStorage.
            this.checkLocalStorage(userInstances);
            if (userInstances.newInstances && userInstances.newInstances.length > 0)
                this.store.dispatch(NewInstanceActions.set_new_instances({ instances: this.makeShell(userInstances.newInstances) }));
            else
                this.store.dispatch(NewInstanceActions.set_new_instances({ instances: [] }));
            if (userInstances.updatedInstances && userInstances.updatedInstances.length > 0)
                this.store.dispatch(UpdateInstanceActions.set_updated_instances({ instances: this.makeShell(userInstances.updatedInstances) }));
            else
                this.store.dispatch(UpdateInstanceActions.set_updated_instances({ instances: [] }));
            if (userInstances.deletedInstances && userInstances.deletedInstances.length > 0)
                this.store.dispatch(DeleteInstanceActions.set_deleted_instances({ instances: this.makeShell(userInstances.deletedInstances) }));
            else
                this.store.dispatch(DeleteInstanceActions.set_deleted_instances({ instances: [] }));    
            if (userInstances.bookmarks && userInstances.bookmarks.length > 0)
                this.store.dispatch(BookmarkActions.set_bookmarks({ instances: userInstances.bookmarks }));
            else
                this.store.dispatch(BookmarkActions.set_bookmarks({ instances: [] }));
            this.loadPathwayDiagramObjects(user, userInstances);
            if (userInstances.defaultPerson)
                this.store.dispatch(DefaultPersonActions.set_default_person(userInstances.defaultPerson));
            else
                this.store.dispatch(DefaultPersonActions.set_default_person(undefined));
        });
    }

    private makeShell(insts: Instance[]) {
        return insts.map(inst => this.instUtils.makeShell(inst));
    }

    private checkLocalStorage(userInstances: UserInstances) {
        const bookmarks = localStorage.getItem(BookmarkActions.set_bookmarks.type);
        if (bookmarks) {
            const bookmarkInsts = JSON.parse(bookmarks);
            userInstances.bookmarks = bookmarkInsts;
        }
        // Instances have been persisted in localstorage fully. Therefore, we need to register
        // them only without actually loading from the database. 
        // schemaClass will be handled whenever it is needed. 
        const updated = localStorage.getItem(UpdateInstanceActions.get_updated_instances.type);
        if (updated) {
            const updatedInsts = JSON.parse(JSON.parse(updated).object);
            userInstances.updatedInstances = updatedInsts;
            updatedInsts.forEach((inst: any) => this.dataService.registerInstance(inst));
        }
        const newInstText = localStorage.getItem(NewInstanceActions.get_new_instances.type);
        if (newInstText) {
            const newInstances = JSON.parse(JSON.parse(newInstText).object);
            userInstances.newInstances = newInstances;
            newInstances.forEach((inst: any) => this.dataService.registerInstance(inst));
        }
        const deleted = localStorage.getItem(DeleteInstanceActions.get_deleted_instances.type);
        if (deleted) {
            const deletedInsts = JSON.parse(JSON.parse(deleted).object);
            userInstances.deletedInstances = deletedInsts;
            deletedInsts.forEach((inst: any) => this.dataService.registerInstance(inst));
        }
        const defaultPerson = localStorage.getItem(DefaultPersonActions.set_default_person.type);
        if (defaultPerson) {
            const defaultPersonInst = JSON.parse(JSON.parse(defaultPerson).object);
            userInstances.defaultPerson = defaultPersonInst;
        }
        const pathwayDiagramObjectsValue = localStorage.getItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type);
        if (pathwayDiagramObjectsValue) {
            const diagramObjects = JSON.parse(JSON.parse(pathwayDiagramObjectsValue).object);
            userInstances.pathwayDiagramObjects = diagramObjects;
        }
    }

    private loadPathwayDiagramObjects(userName: string, userInstances: UserInstances) {
        const localDiagramObjects = userInstances.pathwayDiagramObjects as PathwayDiagramObject[] | undefined;
        if (localDiagramObjects && localDiagramObjects.length > 0)
            this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: localDiagramObjects }));

        const candidateUserNames = Array.from(new Set([
            userName,
            ...this.authService.getUserCandidates()
        ].filter((name: string | undefined): name is string => !!name && name.trim().length > 0)));

        const requests = candidateUserNames.map((candidate: string) =>
            this.dataService.getPathwayDiagrams(candidate).pipe(
                catchError(() => of([] as PathwayDiagramObject[]))
            )
        );

        forkJoin(requests).subscribe({
            next: (diagramObjectGroups: PathwayDiagramObject[][]) => {
                const localObjects = localDiagramObjects ?? [];
                const mergedByDiagramDbId = new Map<number, PathwayDiagramObject>();

                localObjects.forEach((item: PathwayDiagramObject) => {
                    const diagramDbId = Number(item?.pathwayDiagramDbId ?? item?.diagramLock?.diagramDbId ?? item?.dbId);
                    if (Number.isFinite(diagramDbId))
                        mergedByDiagramDbId.set(diagramDbId, item);
                });

                // Backend is the source of truth at login, so let backend snapshots override local ones.
                (diagramObjectGroups || []).flat().forEach((item: PathwayDiagramObject) => {
                    const diagramDbId = Number(item?.pathwayDiagramDbId ?? item?.diagramLock?.diagramDbId ?? item?.dbId);
                    if (Number.isFinite(diagramDbId))
                        mergedByDiagramDbId.set(diagramDbId, item);
                });

                const mergedObjects = Array.from(mergedByDiagramDbId.values());
                userInstances.pathwayDiagramObjects = mergedObjects as any[];
                this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: mergedObjects }));
            },
            error: (error) => {
                console.warn('Failed to load staged pathway diagram objects.', error);
                if (!localDiagramObjects)
                    this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: [] }));
            }
        });
    }

    persistInstances(removeToken: boolean = false, onComplete?: () => void): void {
        console.debug('Calling persist instance before window closing...');
        const done = () => {
            if (onComplete)
                onComplete();
        };
        const user = this.authService.getUser();
        if (!user) {
            console.error('Cannot find a user to persistInstances');
            done();
            return;
        }
        const clearLocalStateForLogout = () => {
            if (!removeToken)
                return;
            const preservedDiagramObjects = localStorage.getItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type);
            const preservedDiagramLockRefs = localStorage.getItem('pathwayDiagramLockRefs');
            const preservedExactSavedNetworks = localStorage.getItem('exactSavedDiagramNetworks');
            localStorage.clear();
            // Restore diagram-only staging caches so edited diagrams can be restored after re-login.
            if (preservedDiagramObjects)
                localStorage.setItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type, preservedDiagramObjects);
            if (preservedDiagramLockRefs)
                localStorage.setItem('pathwayDiagramLockRefs', preservedDiagramLockRefs);
            if (preservedExactSavedNetworks)
                localStorage.setItem('exactSavedDiagramNetworks', preservedExactSavedNetworks);
            // Ensure auth/session identity is removed.
            localStorage.removeItem('token');
            localStorage.removeItem('login_username');
            // Clear diagram draft persisted in session storage so stale drafts are not auto-recovered after re-login.
            sessionStorage.removeItem('pendingPathwayDiagramDraft');
        };
        combineLatest([
            this.store.select(updatedInstances()),
            this.store.select(newInstances()),
            this.store.select(deleteInstances()),
            this.store.select(bookmarkedInstances()),
            this.store.select(defaultPerson()),
            this.store.select(pathwayDiagramObjects())
        ])
            .pipe(take(1)) // Take only the first set of values and complete
            .subscribe(([updated, newInst, deleted, bookmarked, defaultPerson, diagramObjects]) => {
                const updatedInstances = updated || [];
                const newInstances = newInst || [];
                const deletedInstances = deleted || [];
                const bookmarkedInstances = bookmarked || [];
                const pathwayDiagramObjects = diagramObjects || [];
                // There should be only one instance for default person. However, we use
                // an array to make the code simplier
                const defaultPersonInstances = defaultPerson || [];
                const hasDiagramObjects = pathwayDiagramObjects.length > 0;
                const instances = [...newInstances, 
                                   ...updatedInstances,  
                                   ...deletedInstances, 
                                   ...bookmarkedInstances,
                                   ...defaultPersonInstances];
                if (instances.length == 0 && !hasDiagramObjects) {
                    this.dataService.deletePersistedInstances(user).subscribe({
                        next: () => {
                            console.debug('Delete any persisted instance at the server.');
                            clearLocalStateForLogout();
                            done();
                        },
                        error: () => done()
                    });
                    return; // Do nothing
                }
                // Need to persist these instances
                // To be persist
                const userInstances: UserInstances = {
                    newInstances: newInstances,
                    updatedInstances: updatedInstances,
                    deletedInstances: deletedInstances,
                    bookmarks: bookmarkedInstances
                };
                if (defaultPerson.length > 0)
                    userInstances.defaultPerson = defaultPerson[0];
                const completePersist = () => {
                    this.dataService.perisistPathwayDiagram(pathwayDiagramObjects as PathwayDiagramObject[]).subscribe({
                      next: () => {
                        console.debug('pathway diagram objects have been persisted at the server.');
                        clearLocalStateForLogout();
                        done();
                      },
                      error: () => done()
                    });
                };
                if (instances.length == 0) {
                    this.dataService.deletePersistedInstances(user).subscribe({
                        next: () => {
                            console.debug('Delete any persisted instance at the server.');
                            completePersist();
                        },
                        error: () => done()
                    });
                    return;
                }
                this.dataService.persitUserInstances(userInstances, user).subscribe({
                    next: () => {
                        console.debug('userInstances have been persisted at the server.');
                        completePersist();
                    },
                    error: () => done()
                });
            });
    }

}