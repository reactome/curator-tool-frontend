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
      const inst = JSON.parse(event.newValue || '{}');
      switch (event.key) {
        // When a new instance is edited, this case is also
        // applied. Not sure why?
        case NewInstanceActions.register_new_instance.type:
          this.dataService.registerInstance(inst);
          this.store.dispatch(NewInstanceActions.ls_register_new_instance(this.instUtils.makeShell(inst)));
          break;
        case NewInstanceActions.remove_new_instance.type:
          this.store.dispatch(NewInstanceActions.ls_remove_new_instance(inst));
          break;
        case UpdateInstanceActions.register_updated_instance.type:
          this.dataService.registerInstance(inst);
          this.store.dispatch(UpdateInstanceActions.ls_register_updated_instance(this.instUtils.makeShell(inst)));
          // Force to refresh instance view if any
          this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case UpdateInstanceActions.remove_updated_instance.type:
          this.store.dispatch(UpdateInstanceActions.ls_remove_updated_instance(inst));
          this.dataService.removeInstanceInCache(inst.dbId); // Flag to reload
          this.instUtils.setRefreshViewDbId(inst.dbId);
          break;
        case UpdateInstanceActions.last_updated_instance.type:
          // The instance wrapped here most likely or to be registered
          // by register_updated_instance case. Since the two instances are the same
          // it should be fine to register twice.
          this.dataService.registerInstance(inst.instance);
          // Need a shell to avoid locking the instance
          this.store.dispatch(UpdateInstanceActions.ls_last_updated_instance({
            attribute: inst.attribuate,
            instance: this.instUtils.makeShell(inst.instance)
          }));
          break;
        case DeleteInstanceActions.register_deleted_instance.type:
          this.dataService.registerInstance(inst);
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
    // this.store.select(updatedInstances()).subscribe(instances => {
    //   // We need the whole instance
    //   const dbIds = instances.map(i => i.dbId);
    //   this.dataService.fetchInstances(dbIds).subscribe(fullInsts => {
    //     localStorage.setItem(UpdateInstanceActions.get_updated_instances.type, this.instUtils.stringifyInstances(fullInsts));
    //   });
    // });
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
          this.dataService.fetchInstance(action.dbId).subscribe(fullInst => {
            localStorage.setItem(action.type, this.instUtils.stringifyInstance(fullInst));
          });
        })
      ),
    { dispatch: false }
  );

}
