import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { DataService } from "src/app/core/services/data.service";
import { UpdateInstanceActions, NewInstanceActions, DeleteInstanceActions } from "./instance.actions";
import { Store } from "@ngrx/store";
import { tap } from "rxjs";
import { deleteInstances, newInstances, updatedInstances } from "./instance.selectors";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { Instance } from "src/app/core/models/reactome-instance.model";

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
      // console.debug('storage event: ' + event.key);
      const inst = JSON.parse(event.newValue || '{}');
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
          this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case UpdateInstanceActions.last_updated_instance.type:
          // We will use last_updated_instance to catch the change
          // for any update. Not the other. Actually don't use any other
          // to avoid threading race, causing the identity change of the 
          // displayed instance with unexpected effect.
          this.dataService.registerInstance(inst.instance);
          // Need a shell to avoid locking the instance
          this.store.dispatch(UpdateInstanceActions.ls_last_updated_instance({
            attribute: inst.attribuate,
            instance: this.instUtils.makeShell(inst.instance)
          }));
          // By registering instance, the identify if the instance obejct is changed.
          // Therefore, we have to call this again to make sure the same instance is used
          // for both display and cache. This call is duplicated for registering (for updated)
          // But so far, there is no better way to solve this issue
          this.instUtils.setRefreshViewDbId(inst.instance.dbId);
          break;
        case DeleteInstanceActions.register_deleted_instance.type:
          // Don't register any change for the deleted instance.
          // Any update should be handled already by last_updated_instance or add_updated_instance
          // this.dataService.registerInstance(inst);
          this.store.dispatch(DeleteInstanceActions.ls_register_deleted_instance(this.instUtils.makeShell(inst)));
          break;
        case DeleteInstanceActions.remove_deleted_instance.type:
          this.store.dispatch(DeleteInstanceActions.ls_remove_deleted_instance(inst));
          break;
      }
    });

    // call select is to add a listener to the change of the list
    // therefore, we should add it once only, not in the following effects
    // which will be called multiple times.
    this.store.select(updatedInstances()).subscribe(instances => {
      // We need the whole instance
      const dbIds = instances.map(i => i.dbId);
      this.dataService.fetchInstances(dbIds).subscribe(fullInsts => {
        localStorage.setItem(UpdateInstanceActions.get_updated_instances.type, this.instUtils.stringifyInstances(fullInsts));
      });
    });
    this.store.select(newInstances()).subscribe(instances => {
      // We need the whole instance
      const dbIds = instances.map(i => i.dbId);
      this.dataService.fetchInstances(dbIds).subscribe(fullInsts => {
        localStorage.setItem(NewInstanceActions.get_new_instances.type, this.instUtils.stringifyInstances(fullInsts));
      });
    });
    this.store.select(deleteInstances()).subscribe(instances => {
      // We need the whole instance
      const dbIds = instances.map(i => i.dbId);
      this.dataService.fetchInstances(dbIds).subscribe(fullInsts => {
        localStorage.setItem(DeleteInstanceActions.get_deleted_instances.type, this.instUtils.stringifyInstances(fullInsts));
      });
    });
  }

  newInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NewInstanceActions.register_new_instance, 
               NewInstanceActions.remove_new_instance),
        tap((action) => {
          // The browser tab (window) that setItem should not receive this event.
          this.dataService.fetchInstance(action.dbId).subscribe(fullInst => {
            localStorage.setItem(action.type, this.instUtils.stringifyInstance(fullInst));
          });
        })
      ),
    { dispatch: false }
  );


  updateInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UpdateInstanceActions.register_updated_instance, 
               UpdateInstanceActions.remove_updated_instance),
        tap((action) => {
          this.dataService.fetchInstance(action.dbId).subscribe(fullInst => {
            localStorage.setItem(action.type, this.instUtils.stringifyInstance(fullInst));
          });
          // Some extra for remove
          if (action.type === UpdateInstanceActions.remove_updated_instance.type) {
            this.dataService.removeInstanceInCache(action.dbId); // So that it can be re-loaded from database
            this.instUtils.setRefreshViewDbId(action.dbId);
          }
        })
      ),
    { dispatch: false }
  );

  lastUpdateInstanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UpdateInstanceActions.last_updated_instance),
        tap((action) => {
          this.dataService.fetchInstance(action.instance.dbId).subscribe(fullInst => {
            const clone = {
              attribuate: action.attribute,
              instance: {
                ...fullInst,
                schemaClass: undefined, // No need to push the schemaClass around
                attributes: fullInst.attributes ? Object.fromEntries(fullInst.attributes) : undefined
              }
            }
            localStorage.setItem(action.type, JSON.stringify(clone));
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
               DeleteInstanceActions.remove_deleted_instance),
        tap((action) => {
          // There is no need to query. Actually nothing to query.
          localStorage.setItem(action.type, this.instUtils.stringifyInstance(action.valueOf() as Instance));
        })
      ),
    { dispatch: false }
  );

}
