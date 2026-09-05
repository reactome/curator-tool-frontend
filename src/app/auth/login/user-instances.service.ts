import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { combineLatest, defaultIfEmpty, finalize, forkJoin, Observable, of, take } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { DiagramLock, Instance, UserInstances } from "src/app/core/models/reactome-instance.model";
import { AuthenticateService } from "src/app/core/services/authenticate.service";
import { DataService } from "src/app/core/services/data.service";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { DefaultPersonActions, DeleteInstanceActions, NewInstanceActions, UpdateInstanceActions } from "src/app/instance/state/instance.actions";
import { defaultPerson, deleteInstances, newInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { BookmarkActions } from "src/app/schema-view/instance-bookmark/state/bookmark.actions";
import { bookmarkedInstances } from "src/app/schema-view/instance-bookmark/state/bookmark.selectors";
// import { PathwayDiagramObjectActions } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.actions";
// import { pathwayDiagramObjects } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.selectors";
// import { PathwayDiagramObject } from "src/app/event-view/components/pathway-diagram/state/pathway-diagram-object.model";

/**
 * Group a set of utility methods here for easy access to all other classes.
 */
@Injectable({
    providedIn: 'root'
})
export class UserInstancesService {
    private readonly pathwayDiagramLockRefsStorageKey = 'pathwayDiagramLockRefs';
    private readonly exactSavedDiagramNetworksStorageKey = 'exactSavedDiagramNetworks';
    private readonly pendingPathwayDiagramDraftSessionKey = 'pendingPathwayDiagramDraft';
    private readonly pathwayDiagramPersistIntervalMs = 2 * 60 * 1000;
    private pathwayDiagramPersistTimer: ReturnType<typeof setInterval> | undefined;
    private isPersistingPathwayDiagrams = false;
    // Broadcasts a wholesale replacement of the staged new/updated/deleted instances,
    // bookmarks, and default person (restoreUserInstanceBackup()/importUserInstancesFromFile())
    // to every other open tab. Distinct from the per-mutation broadcasts in InstanceEffects,
    // which only cover incremental register/remove/update actions, not a bulk replace.
    private readonly userInstancesSyncBroadcastKey = 'syncUserInstances';

    constructor(private instUtils: InstanceUtilities,
        private dataService: DataService,
        private authService: AuthenticateService,
        private store: Store) {
        window.addEventListener('storage', (event: StorageEvent) => {
            if (event.key !== this.userInstancesSyncBroadcastKey)
                return;
            const userInstances = this.parseBroadcastPayload(event.newValue);
            if (!userInstances)
                return;
            // Hydrate independently in this tab (its own id2instance/schemaClass caches are
            // separate from the tab that broadcast this) and apply, but don't re-broadcast -
            // only the tab where the user actually triggered the restore/import does that.
            this.dataService.hydrateUserInstances(userInstances).pipe(
                catchError(() => of(undefined))
            ).subscribe((hydrated: UserInstances | undefined) => {
                if (hydrated)
                    this.applyUserInstancesToEditingSession(hydrated);
            });
        });
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
        // this.cacheUserDiagramLocks(user);
        this.startPathwayDiagramAutoPersist();
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
            this.pruneStaleBookmarks(userInstances.bookmarks ?? []);
            // this.loadPathwayDiagramObjects(user, userInstances);
            if (userInstances.defaultPerson)
                this.store.dispatch(DefaultPersonActions.set_default_person(userInstances.defaultPerson));
            else
                this.store.dispatch(DefaultPersonActions.set_default_person(undefined));
        });
    }

    /**
     * Bookmarks are only ever refreshed lazily while the app is open (see
     * BookmarkListComponent, which re-fetches one on refreshViewDbId$), so a restored bookmark
     * can point at an instance that was deleted, or renamed/reclassified, by this user in
     * another tab or by someone else since it was bookmarked. Check every restored bookmark
     * against the database once: drop any whose instance no longer exists, and refresh the
     * shell (schemaClassName/displayName) of any whose instance changed since it was bookmarked.
     *
     * Uses dataService.fetchBookmarkShell() rather than fetchInstance(): fetchInstance would
     * happily return a cached copy for a bookmark already fetched earlier in this session,
     * silently skipping the very check we're trying to do. fetchBookmarkShell() only reports a
     * bookmark gone on a genuine 404 - a transient failure (network blip, session expiry)
     * resolves to the bookmark's current shell unchanged, so a flaky moment during reload can't
     * wrongly wipe out or misreport valid bookmarks.
     */
    private pruneStaleBookmarks(bookmarks: Instance[]): void {
        if (!bookmarks || bookmarks.length === 0)
            return;
        forkJoin(
            bookmarks.map(bookmark =>
                this.dataService.fetchBookmarkShell(bookmark.dbId).pipe(
                    catchError(() => of(bookmark))
                )
            )
        ).subscribe(refreshed => {
            refreshed.forEach((fresh, i) => {
                const bookmark = bookmarks[i];
                if (!fresh) {
                    this.store.dispatch(BookmarkActions.remove_bookmark(bookmark));
                } else if (fresh.schemaClassName !== bookmark.schemaClassName || fresh.displayName !== bookmark.displayName) {
                    this.instUtils.refreshShellInstance(fresh);
                    this.store.dispatch(BookmarkActions.add_bookmark(fresh));
                }
            });
        });
    }

    /**
     * Replace the currently staged new/updated/deleted instances, bookmarks, and default person
     * with the content of one specific backup. This only replaces the in-browser editing session
     * (the ngrx store) - it does NOT persist anything to the server. The previously-current state
     * is not saved anywhere by this call; if the user wants to keep it, they should not have
     * unsaved changes they care about before restoring, since this simply loads the backup for
     * review - saving it (if desired) still goes through the normal persistInstances save path.
     * @param fileName as returned by DataService.listUserInstanceBackups()
     */
    restoreUserInstanceBackup(fileName: string): Observable<UserInstances> {
        return this.dataService.loadUserInstanceBackup(fileName).pipe(
            tap((userInstances: UserInstances) => {
                this.applyUserInstancesToEditingSession(userInstances);
                this.broadcastUserInstances(userInstances);
            })
        );
    }

    /**
     * Debugging aid: serialize this tab's currently staged new/updated/deleted instances,
     * bookmarks, and default person exactly as persistInstances() would send them, so the
     * result can be written to a local file and later reloaded with importUserInstancesFromFile().
     */
    exportUserInstances(): Observable<string> {
        return combineLatest([
            this.store.select(updatedInstances()),
            this.store.select(newInstances()),
            this.store.select(deleteInstances()),
            this.store.select(bookmarkedInstances()),
            this.store.select(defaultPerson()),
        ]).pipe(
            take(1),
            map(([updated, newInst, deleted, bookmarked, defaultPersonInstances]) => {
                const userInstances: UserInstances = {
                    newInstances: newInst || [],
                    updatedInstances: updated || [],
                    deletedInstances: deleted || [],
                    bookmarks: bookmarked || [],
                    defaultPerson: (defaultPersonInstances && defaultPersonInstances.length > 0)
                        ? defaultPersonInstances[0]
                        : undefined,
                };
                return this.dataService.computePersistPayload(userInstances);
            })
        );
    }

    /**
     * Debugging aid: the counterpart to exportUserInstances() - replaces the currently staged
     * new/updated/deleted instances, bookmarks, and default person with the content of a
     * UserInstances object parsed from a locally exported file. Same in-browser-only semantics
     * as restoreUserInstanceBackup(): nothing is persisted to the server by this call. Also
     * broadcast to every other open tab (see the window:storage listener in the constructor) so
     * all tabs end up showing the same newly loaded state, not just this one.
     */
    importUserInstancesFromFile(userInstances: UserInstances): Observable<UserInstances> {
        return this.dataService.hydrateUserInstances(userInstances).pipe(
            tap((hydrated: UserInstances) => {
                this.applyUserInstancesToEditingSession(hydrated);
                this.broadcastUserInstances(hydrated);
            })
        );
    }

    private applyUserInstancesToEditingSession(userInstances: UserInstances): void {
        this.store.dispatch(NewInstanceActions.set_new_instances({ instances: this.makeShell(userInstances.newInstances ?? []) }));
        this.store.dispatch(UpdateInstanceActions.set_updated_instances({ instances: this.makeShell(userInstances.updatedInstances ?? []) }));
        this.store.dispatch(DeleteInstanceActions.set_deleted_instances({ instances: this.makeShell(userInstances.deletedInstances ?? []) }));
        this.store.dispatch(BookmarkActions.set_bookmarks({ instances: userInstances.bookmarks ?? [] }));
        this.pruneStaleBookmarks(userInstances.bookmarks ?? []);
        this.store.dispatch(DefaultPersonActions.set_default_person(userInstances.defaultPerson));
        this.dataService.resetNextNewDbId();
    }

    /**
     * Broadcasts a wholesale UserInstances replacement to every other open tab. Re-derives the
     * plain, JSON-serializable shape via computePersistPayload() rather than serializing
     * `userInstances` directly, since a hydrated UserInstances holds attributes as Maps and a
     * populated schemaClass - neither of which JSON.stringify can round-trip. Each receiving tab
     * re-hydrates independently (see the window:storage listener in the constructor), since
     * id2instance/schemaClass caches are per-tab.
     */
    private broadcastUserInstances(userInstances: UserInstances): void {
        const payload = this.dataService.computePersistPayload(userInstances);
        localStorage.setItem(this.userInstancesSyncBroadcastKey,
            JSON.stringify({ object: payload, timestamp: Date.now() }));
    }

    private parseBroadcastPayload(content: string | undefined | null): UserInstances | undefined {
        try {
            const value = JSON.parse(content || '{}');
            return JSON.parse(value.object || '{}');
        } catch {
            return undefined;
        }
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
            // Unlike updated/new instances, the deleted-instances snapshot only ever holds
            // shells (dbId/displayName/schemaClassName - see storeDeletedInstances(), which
            // persists the deleteInstances store slice as-is without fetching full instances).
            // Registering a shell here would poison the full-instance cache under this dbId,
            // so a later fetchInstance() call returns the shell instead of loading the real
            // instance from the database. Let it load fresh from the database on demand instead.
        }
        const defaultPerson = localStorage.getItem(DefaultPersonActions.set_default_person.type);
        if (defaultPerson) {
            const defaultPersonInst = JSON.parse(JSON.parse(defaultPerson).object);
            userInstances.defaultPerson = defaultPersonInst;
        }
        // const pathwayDiagramObjectsValue = localStorage.getItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type);
        // if (pathwayDiagramObjectsValue) {
        //     const diagramObjects = JSON.parse(JSON.parse(pathwayDiagramObjectsValue).object);
        //     userInstances.pathwayDiagramObjects = diagramObjects;
        // }
    }

    // private loadPathwayDiagramObjects(userName: string, userInstances: UserInstances) {
    //     const localDiagramObjects = userInstances.pathwayDiagramObjects as PathwayDiagramObject[] | undefined;
    //     if (localDiagramObjects && localDiagramObjects.length > 0)
    //         this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: localDiagramObjects }));

    //     const candidateUserNames = Array.from(new Set([
    //         userName,
    //         ...this.authService.getUserCandidates()
    //     ].filter((name: string | undefined): name is string => !!name && name.trim().length > 0)));

    //     const requests = candidateUserNames.map((candidate: string) =>
    //         this.dataService.getPathwayDiagrams(candidate).pipe(
    //             catchError(() => of([] as PathwayDiagramObject[]))
    //         )
    //     );

    //     forkJoin(requests).subscribe({
    //         next: (diagramObjectGroups: PathwayDiagramObject[][]) => {
    //             const localObjects = localDiagramObjects ?? [];
    //             const mergedByDiagramDbId = new Map<number, PathwayDiagramObject>();

    //             localObjects.forEach((item: PathwayDiagramObject) => {
    //                 const diagramDbId = Number(item?.pathwayDiagramDbId ?? item?.pathwayDiagramDbId ?? item?.diagramLock?.diagramDbId);
    //                 if (Number.isFinite(diagramDbId))
    //                     mergedByDiagramDbId.set(diagramDbId, item);
    //             });

    //             // Backend is the source of truth at login, so let backend snapshots override local ones.
    //             (diagramObjectGroups || []).flat().forEach((item: PathwayDiagramObject) => {
    //                 const diagramDbId = Number(item?.pathwayDiagramDbId ?? item?.pathwayDiagramDbId ?? item?.diagramLock?.diagramDbId);
    //                 if (Number.isFinite(diagramDbId))
    //                     mergedByDiagramDbId.set(diagramDbId, item);
    //             });

    //             const mergedObjects = Array.from(mergedByDiagramDbId.values());
    //             userInstances.pathwayDiagramObjects = mergedObjects as any[];
    //             this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: mergedObjects }));
    //         },
    //         error: (error) => {
    //             console.warn('Failed to load staged pathway diagram objects.', error);
    //             if (!localDiagramObjects)
    //                 this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: [] }));
    //         }
    //     });
    // }

    /**
     * @param useBeacon Only set from the window:beforeunload handler. The page may be torn
     * down before a normal request completes, so this mode fires a single fetch(keepalive)
     * POST of whatever this tab currently has staged - and only ever adds to the server
     * backup, never deletes it, even if this tab's own staged lists happen to be empty. That
     * keeps the fast/unreliable path safe: a tab with nothing staged simply does nothing,
     * rather than risking a wipe of a sibling tab's not-yet-broadcast changes. Clearing/
     * deleting the backup when everything is genuinely empty is left to the normal (non-beacon)
     * persist path below.
     * @param expectedToken Only meaningful together with removeToken. If given, the destructive
     * part of the logout (localStorage.clear() and the backend logout call) is skipped unless
     * the token in localStorage is still this one by the time the (asynchronous) persist/delete
     * call completes. This is for a logout that was decided upon *before* that asynchronous call
     * was started (e.g. an inactivity timeout) - by the time it finishes, a fresh login elsewhere
     * in the same tab may already have replaced the stale session this logout was for, and
     * tearing down local state at that point would clobber the new session instead of the stale
     * one. Callers that want an unconditional logout (e.g. a user-initiated "Log out") should
     * leave this unset. onComplete is passed whether the logout actually happened.
     */
    persistInstances(removeToken: boolean = false, onComplete?: (loggedOut: boolean) => void, useBeacon: boolean = false, expectedToken?: string | null): void {
        console.debug('Calling persist instance before window closing...');
        const done = (loggedOut: boolean = false) => {
            if (onComplete)
                onComplete(loggedOut);
        };
        const user = this.authService.getUser();
        if (!user) {
            console.error('Cannot find a user to persistInstances');
            done();
            return;
        }
        const clearLocalStateForLogout = (): boolean => {
            if (!removeToken)
                return false;
            if (expectedToken !== undefined && localStorage.getItem('token') !== expectedToken) {
                // The session this logout was decided for has already been replaced (most likely
                // a fresh login that happened while the persist/delete call above was in flight).
                // Leave the new session's local state alone rather than clearing it out from
                // under the user.
                console.debug('Skipping logout cleanup: the session has changed since this logout was requested.');
                return false;
            }
            // Tell the backend to invalidate the session and expire the HttpOnly refresh cookie.
            // This is best-effort and fire-and-forget: the local session is torn down regardless
            // of the result, so the user is always logged out client-side even if the call fails.
            // Fired before localStorage is cleared so the request still carries the current cookie.
            this.authService.logout().subscribe({
                error: (err) => console.warn('Backend logout call failed; clearing local session anyway.', err)
            });
            this.stopPathwayDiagramAutoPersist();
            const preservedValues = this.captureLocalStorageValues([
                // PathwayDiagramObjectActions.get_pathway_diagram_objects.type,
                this.pathwayDiagramLockRefsStorageKey,
                this.exactSavedDiagramNetworksStorageKey
            ]);
            localStorage.clear();
            this.restoreLocalStorageValues(preservedValues);
            // Ensure auth/session identity is removed.
            localStorage.removeItem('token');
            localStorage.removeItem('login_username');
            // Clear diagram draft persisted in session storage so stale drafts are not auto-recovered after re-login.
            sessionStorage.removeItem(this.pendingPathwayDiagramDraftSessionKey);
            return true;
        };
        combineLatest([
            this.store.select(updatedInstances()),
            this.store.select(newInstances()),
            this.store.select(deleteInstances()),
            this.store.select(bookmarkedInstances()),
            this.store.select(defaultPerson()),
            // this.store.select(pathwayDiagramObjects())
        ])
            .pipe(take(1)) // Take only the first set of values and complete
            .subscribe(([updated, newInst, deleted, bookmarked, defaultPersonInstances]) => {
                const local: UserInstances = {
                    newInstances: newInst || [],
                    updatedInstances: updated || [],
                    deletedInstances: deleted || [],
                    bookmarks: bookmarked || [],
                    defaultPerson: (defaultPersonInstances && defaultPersonInstances.length > 0)
                        ? defaultPersonInstances[0]
                        : undefined,
                };
                if (useBeacon) {
                    if (this.countStagedInstances(local) > 0)
                        this.dataService.persistUserInstancesBeacon(local, user);
                    done();
                    return;
                }
                // This tab's current staged state is sent as-is and wins outright - no merge
                // with whatever the server currently holds. An earlier version of this method
                // fetched the server's snapshot first and carried over any dbId missing from
                // `local`, meaning to protect a sibling tab's very-recent, not-yet-broadcast
                // change from being silently dropped. But "missing from local" can't be told
                // apart from "this tab deliberately removed/committed it", so that merge
                // resurrected instances the user had just removed - e.g. deleting staged new
                // instances and reloading would bring them back. Front-end state (including
                // deletions) must win outright, so persist local state directly instead.
                // Whether the server call succeeds or fails, a logout must still log the user
                // out: clearLocalStateForLogout() used to run only on success, so a failed
                // persist/delete left the token and the refresh cookie in place while the UI
                // navigated to /login - the user looked signed out but was not, and no other
                // tab was told anything either (SessionSyncService keys off the token being
                // removed). Losing the server-side backup is bad; silently keeping a live
                // session the user asked to end is worse.
                if (this.countStagedInstances(local) === 0) {
                    this.dataService.deletePersistedInstances(user).subscribe({
                        next: () => {
                            console.debug('Delete any persisted instance at the server.');
                            done(clearLocalStateForLogout());
                        },
                        error: (err) => {
                            console.warn('Failed to delete persisted instances; logging out anyway.', err);
                            done(clearLocalStateForLogout());
                        }
                    });
                    return;
                }
                this.dataService.persitUserInstances(local, user).subscribe({
                    next: () => {
                        console.debug('userInstances have been persisted at the server.');
                        done(clearLocalStateForLogout());
                    },
                    error: (err) => {
                        console.warn('Failed to persist user instances; logging out anyway.', err);
                        done(clearLocalStateForLogout());
                    }
                });
            });
    }

    private countStagedInstances(userInstances: UserInstances): number {
        return (userInstances.newInstances?.length ?? 0)
            + (userInstances.updatedInstances?.length ?? 0)
            + (userInstances.deletedInstances?.length ?? 0)
            + (userInstances.bookmarks?.length ?? 0)
            + (userInstances.defaultPerson ? 1 : 0);
    }

    private startPathwayDiagramAutoPersist(): void {
        if (this.pathwayDiagramPersistTimer)
            return;
        this.pathwayDiagramPersistTimer = setInterval(() => {
            this.flushPathwayDiagramsToBackend();
        }, this.pathwayDiagramPersistIntervalMs);
    }

    private stopPathwayDiagramAutoPersist(): void {
        if (!this.pathwayDiagramPersistTimer)
            return;
        clearInterval(this.pathwayDiagramPersistTimer);
        this.pathwayDiagramPersistTimer = undefined;
    }

    private flushPathwayDiagramsToBackend(): void {
        if (this.isPersistingPathwayDiagrams)
            return;
        const user = this.authService.getUser();
        if (!user)
            return;

        // this.store.select(pathwayDiagramObjects()).pipe(take(1)).subscribe((objects: PathwayDiagramObject[] | undefined) => {
        //     const diagramObjects = objects || [];
        //     if (diagramObjects.length === 0)
        //         return;

        //     this.isPersistingPathwayDiagrams = true;
        //     this.dataService.perisistPathwayDiagram(diagramObjects, user).subscribe({
        //         next: () => {
        //             this.isPersistingPathwayDiagrams = false;
        //         },
        //         error: () => {
        //             this.isPersistingPathwayDiagrams = false;
        //         }
        //     });
        // });
    }

    private captureLocalStorageValues(keys: string[]): Map<string, string> {
        const captured = new Map<string, string>();
        keys.forEach((key: string) => {
            const value = localStorage.getItem(key);
            if (value !== null)
                captured.set(key, value);
        });
        return captured;
    }

    private restoreLocalStorageValues(values: Map<string, string>): void {
        values.forEach((value: string, key: string) => {
            localStorage.setItem(key, value);
        });
    }

}