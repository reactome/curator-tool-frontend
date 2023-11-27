import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { InstanceActions } from "./instance.actions";

/**
 * Reducer to handle the instance to be viewed.
 */
export const initialInstance: Instance = { dbId: 0 };

export const viewInstanceReducer = createReducer(
  initialInstance,
  on(InstanceActions.view_instance, (state, instance) => instance)
);

/**
 * Reducer to handle registration of updated instance
 */
export const updatedInstances: Instance[] = [];

export const updatedInstancesReducer = createReducer(
  updatedInstances,
  on(InstanceActions.register_updated_instance, (state, instance) => {
    // Check based on dbId
    let exists: boolean = false;
    for (let tmp of state) {
      if (tmp.dbId === instance.dbId) {
        exists = true;
        break;
      }
    }
    if (exists) return state;
    return [...state, instance]
  }
  )
);
