import { createReducer, on } from "@ngrx/store";
import {Instance} from "src/app/core/models/reactome-instance.model";
import { InstanceActions } from "./instance.actions";

/**
 * Reducer to handle the instance to be viewed.
 */
export const initialInstance: Instance = new Instance(0);

export const viewInstanceReducer = createReducer(
  initialInstance,
  on(InstanceActions.view_instance, (state, instance) => instance)
);
