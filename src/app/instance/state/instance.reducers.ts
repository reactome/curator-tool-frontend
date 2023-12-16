import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { InstanceActions } from "./instance.actions";
import { createEntityAdapter, EntityState } from "@ngrx/entity";
import {state} from "@angular/animations";
import { InstantiateExpr } from "@angular/compiler";

/**
 * Reducer to handle the instance to be viewed.
 */
export const initialInstance: Instance = { dbId: 0 };

export const viewInstanceReducer = createReducer(
  initialInstance,
  on(InstanceActions.view_instance, (state, instance) => createShellInstance(instance))
);

/**
 * Reducer to handle registration of updated instance
 */
export interface UpdatedInstanceState extends EntityState<Instance> {
}

export const updatedInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const dbInstanceAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})
export const updatedInstancesReducer = createReducer(
  updatedInstancesAdaptor.getInitialState(),
  on(InstanceActions.register_updated_instance,
    (state, instance) => {
      // Use a shell copy of instance
      let _instance: Instance = createShellInstance(instance);
      return updatedInstancesAdaptor.upsertOne(_instance, state);
    }
  ),
  on(InstanceActions.remove_updated_instance,
    (state, instance) => updatedInstancesAdaptor.removeOne(instance.dbId, state))
)

function createShellInstance(template: Instance): Instance {
  let rtn = {
    dbId: template.dbId,
    displayName: template.displayName,
    schemaClassName: template.schemaClassName
  };
  return rtn;
}
