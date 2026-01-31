import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { DataService } from "src/app/core/services/data.service";
import { UpdateInstanceActions, NewInstanceActions, DeleteInstanceActions, DefaultPersonActions } from "./instance.actions";
import { Store } from "@ngrx/store";
import { defaultIfEmpty, take, tap } from "rxjs";
import { deleteInstances, newInstances, updatedInstances } from "./instance.selectors";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { BookmarkActions } from "src/app/schema-view/instance-bookmark/state/bookmark.actions";

// Keep it for the time being as a placeholder. May not use it in the future.
@Injectable()
//Note: Make sure add this to the root as following. Otherwise, the event method
// listener to the storage will be called twice!!! This is more like a bug in Angular!
// EffectsModule.forRoot([BookmarkEffects, InstanceEffects]),
export class InstanceEffects {

  constructor(
    private actions$: Actions,
    private store: Store,
    private dataService: DataService,
    private instUtils: InstanceUtilities
  ) {
    window.addEventListener('storage', (event) => {
      console.debug('storage event: ' + event.key);
      if (event.key === 'token')
        return; // Don't do anything for token
      const inst = this.parseLocalStorageObject(event.newValue);
      switch (event.key) {
        // When a new instance is edited, this case is also
        // applied. Not sure why?
        case NewInstanceActions.register_new_instance.type:
          this.dataService.registerInstance(inst);
          this.store.dispatch(NewInstanceActions.ls_register_new_instance(this.instUtils.makeShell(inst)));
          // Don't send the signal to update. Will do via last_updated if any
          // this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case NewInstanceActions.remove_new_instance.type:
          this.store.dispatch(NewInstanceActions.ls_remove_new_instance(inst));
          break;
        case NewInstanceActions.commit_new_instance.type:
          // Need to refresh the view if an instance is committed other place
          this.instUtils.setCommittedNewInstDbId(inst.oldDbId, inst.newDbId);
          break;
        case UpdateInstanceActions.register_updated_instance.type:
          // this.dataService.registerInstance(inst);
          this.store.dispatch(UpdateInstanceActions.ls_register_updated_instance(this.instUtils.makeShell(inst)));
          // Force to refresh instance view if any
          // this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case UpdateInstanceActions.remove_updated_instance.type:
          this.store.dispatch(UpdateInstanceActions.ls_remove_updated_instance(inst));
          this.dataService.removeInstanceInCache(inst.dbId); // Flag to reload
          // This will not conflict with last_updated_instance
          // Refresh multiple times doesn't hurt so far.
          this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case UpdateInstanceActions.reset_updated_instance.type:
          this.store.dispatch(UpdateInstanceActions.ls_reset_updated_instance(inst));
          this.dataService.removeInstanceInCache(inst.instance.dbId); // Flag to reload
          // This will not conflict with last_updated_instance
          this.resetInstance(inst.modifiedAttributes, inst.instance.dbId);
          break;
        case UpdateInstanceActions.last_updated_instance.type:
          // We will use last_updated_instance to catch the change
          // for any update. Not the other. Actually don't use any other
          // to avoid threading race, causing the identity change of the 
          // displayed instance with unexpected effect.
          this.dataService.registerInstance(inst.instance);
          // Need a shell to avoid locking the instance
          this.store.dispatch(UpdateInstanceActions.ls_last_updated_instance({
            attribute: inst.attribute,
            instance: this.instUtils.makeShell(inst.instance)
          }));
          // By registering instance, the identity of the instance object is changed.
          // Therefore, we have to call this again to make sure the same instance is used
          // for both display and cache. This call is duplicated for registering (for updated)
          // But so far, there is no better way to solve this issue
          this.instUtils.setRefreshViewDbId(inst.instance.dbId);
          this.instUtils.setLastUpdatedInstance(inst.attribute, inst.instance);
          break;
        case DeleteInstanceActions.register_deleted_instance.type:
          // Don't register any change for the deleted instance.
          // Any update should be handled already by last_updated_instance or add_updated_instance
          // this.dataService.registerInstance(inst);
          const shell = this.instUtils.makeShell(inst);
          this.store.dispatch(DeleteInstanceActions.ls_register_deleted_instance(shell));
          this.store.dispatch(BookmarkActions.remove_bookmark(shell));
          this.instUtils.setMarkDeletionDbId(inst.dbId);
          break;
        case DeleteInstanceActions.remove_deleted_instance.type:
          this.store.dispatch(DeleteInstanceActions.ls_remove_deleted_instance(inst));
          this.store.dispatch(BookmarkActions.ls_remove_bookmark(this.instUtils.makeShell(inst)));
          break;
        // All deleted instances will be removed from the store in the above action.
        // We need to clairfy if an instance is reset or committed as deleted.
        case (DeleteInstanceActions.reset_deleted_instance.type):
          this.instUtils.setResetDeletedDbId(inst.dbId);
          break;
        case (DeleteInstanceActions.commit_deleted_instance.type):
          this.dataService.removeInstanceInCache(inst.dbId);
          this.instUtils.setDeletedDbId(inst.dbId);
          break;
        case DefaultPersonActions.set_default_person.type:
          this.store.dispatch(DefaultPersonActions.ls_set_default_person(this.instUtils.makeShell(inst)));
          break;
      }
    });
  }

  newInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NewInstanceActions.register_new_instance,
          NewInstanceActions.remove_new_instance),
        tap((action) => {
          if (action.type === NewInstanceActions.register_new_instance.type)
            // The browser tab (window) that setItem should not receive this event.
            this.dataService.fetchInstance(action.dbId).subscribe(fullInst => {
              this.setLocalStorageItem(action.type, this.instUtils.stringifyInstance(fullInst));
            });
          else if (action.type === NewInstanceActions.remove_new_instance.type) {
            // There is no need to query. Actually nothing to query.
            this.setLocalStorageItem(action.type, this.instUtils.stringifyInstance(action.valueOf() as Instance));
            // Remove a new instance will remove it from the cached value
            this.dataService.removeInstanceInCache(action.dbId);
          }
          // TODO: Check if this is needed
          this.storeNewInstances();
        })
      ),
    { dispatch: false }
  );

  newInstanceCommit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NewInstanceActions.commit_new_instance),
        tap((action) => {
          const obj: any = action.valueOf();
          this.setLocalStorageItem(action.type, JSON.stringify(obj));
          // call here so that we don't have any side effect in this tab
          this.instUtils.setCommittedNewInstDbId(action.oldDbId, action.newDbId);
        })
      ),
    { dispatch: false }
  );


  updateInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UpdateInstanceActions.register_updated_instance,
          UpdateInstanceActions.remove_updated_instance,
          UpdateInstanceActions.reset_updated_instance),
        tap((action) => {
          this.setLocalStorageItem(action.type, JSON.stringify(action.valueOf()));
          this.storeUpdatedInstances();
          // Some extra for remove
          if (action.type === UpdateInstanceActions.remove_updated_instance.type) {
            this.dataService.removeInstanceInCache(action.dbId); // So that it can be re-loaded from database
            // No need to refresh view dbId here. Let lastInstanceEdit handle this.
            this.instUtils.setRefreshViewDbId(action.dbId);
          }
          else if (action.type === UpdateInstanceActions.reset_updated_instance.type) {
            this.dataService.removeInstanceInCache(action.instance.dbId);
            this.resetInstance(action.modifiedAttributes, action.instance.dbId); 
            this.instUtils.setRefreshViewDbId(action.instance.dbId);
          }
        })
      ),
    { dispatch: false }
  );

  private resetInstance(modifiedAttributes: string[] | undefined, dbId: number) {
    // Need to reload the instance in case it is used in the local loaded instance
    // By loading them, we can make sure the display names in these local instances
    // are correctly for this reset instance in their attributes
    this.dataService.fetchInstance(dbId).subscribe(inst => {
      this.instUtils.setResetInstance(modifiedAttributes, inst);
    });
  }

  lastUpdateInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UpdateInstanceActions.last_updated_instance),
        tap((action) => {
          this.dataService.fetchInstance(action.instance.dbId).subscribe(fullInst => {
            const clone = {
              attribute: action.attribute,
              instance: {
                ...fullInst,
                schemaClass: undefined, // No need to push the schemaClass around
                attributes: fullInst.attributes ? Object.fromEntries(fullInst.attributes) : undefined
              }
            }
            this.setLocalStorageItem(action.type, JSON.stringify(clone));
            // Need the full inst for other
            this.instUtils.setLastUpdatedInstance(action.attribute, fullInst);
          });
          // There is no need to put the whole list into the local storage.
          // This should be handled by the above effect
        })
      ),
    { dispatch: false }
  );


  deleteInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DeleteInstanceActions.register_deleted_instance,
          DeleteInstanceActions.remove_deleted_instance,
          DeleteInstanceActions.reset_deleted_instance,
          DeleteInstanceActions.commit_deleted_instance),
        tap((action) => {
          // There is no need to query. Actually nothing to query.
          this.setLocalStorageItem(action.type, this.instUtils.stringifyInstance(action.valueOf() as Instance));
          this.storeDeletedInstances();
          if (action.type === DeleteInstanceActions.register_deleted_instance.type)
            this.instUtils.setMarkDeletionDbId(action.dbId);
          else if( action.type === DeleteInstanceActions.reset_deleted_instance.type){
            this.instUtils.setResetDeletedDbId(action.dbId);
          }
        })
      ),
    { dispatch: false }
  );


  defaultPersonChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DefaultPersonActions.set_default_person),
        tap((action) => {
          // console.debug('Set local storage item: ', action.type);
          this.setLocalStorageItem(action.type, this.instUtils.stringifyInstance(action.valueOf() as Instance));
        })
      ),
    { dispatch: false } // This is important to avoid infinity loop.
  );


  private storeDeletedInstances() {
    this.store.select(deleteInstances()).pipe(take(1)).subscribe(instances => {
      this.setLocalStorageItem(DeleteInstanceActions.get_deleted_instances.type, this.instUtils.stringifyInstances(instances));
    });
  }

  private storeNewInstances() {
    this.store.select(newInstances()).pipe(take(1)).subscribe(instances => {
      // We need the whole instance
      const dbIds = instances.map(i => i.dbId);
      this.dataService.fetchInstances(dbIds).pipe(defaultIfEmpty([])).subscribe(fullInsts => {
        // Need this list so that we can persist it.
        this.setLocalStorageItem(NewInstanceActions.get_new_instances.type, this.instUtils.stringifyInstances(fullInsts));
      });
    });
  }

  private storeUpdatedInstances() {
    this.store.select(updatedInstances()).pipe(take(1)).subscribe(instances => {
      // We need the whole instance
      const dbIds = instances.map(i => i.dbId);
      this.dataService.fetchInstances(dbIds).pipe(defaultIfEmpty([])).subscribe(fullInsts => {
        // Don't remove the item if it is empty. We need to use an empty array as a change
        // evidence. Otherwise, we cannot see the difference between the saved state and the changed state
        this.setLocalStorageItem(UpdateInstanceActions.get_updated_instances.type, this.instUtils.stringifyInstances(fullInsts));
      });
    });
  }

  private setLocalStorageItem(key: string, object: string) {
    localStorage.setItem(key,
      JSON.stringify({ object: object, timestamp: Date.now() })); // Use timestamp to force firing the window event.
  }

  // TODO: test the attributes of the instance, do we need to use the instance service 'handleInstanceAttributes' method here?
  private parseLocalStorageObject(content: string | undefined | null) {
    const value = JSON.parse(content || '{}');
    return JSON.parse(value.object || '{}');
  }

}
