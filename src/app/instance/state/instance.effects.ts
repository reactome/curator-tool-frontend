import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { DataService } from "src/app/core/services/data.service";
import { NewInstanceActions } from "./instance.actions";
import { Store } from "@ngrx/store";
import { tap } from "rxjs";
import { newInstances } from "./instance.selectors";
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
        case NewInstanceActions.register_new_instance.type:
          this.dataService.registerInstance(inst);
          this.store.dispatch(NewInstanceActions.ls_register_new_instance(inst));
          break;
        case NewInstanceActions.remove_new_instance.type:
          this.store.dispatch(NewInstanceActions.ls_remove_new_instance(inst));
          break;
      }
    })
  }

  instanceChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NewInstanceActions.register_new_instance, NewInstanceActions.remove_new_instance),
        tap((action) => {
          // The browser tab (window) that setItem should not receive this event.
          localStorage.setItem(action.type, this.instUtils.stringifyInstance(action.valueOf() as Instance));
          // Update the list of instances for new tabs or windows
          // This probably should be fast since all instances have been loaded
          this.store.select(newInstances()).subscribe(instances => {
            // We need the whole instance
            const dbIds = instances.map(i => i.dbId);
            this.dataService.fetchInstances(dbIds).subscribe(fullInsts => {
              localStorage.setItem(NewInstanceActions.get_new_instances.type, this.instUtils.stringifyInstances(fullInsts));
            });
          });
        })
      ),
    { dispatch: false }
  );



}
