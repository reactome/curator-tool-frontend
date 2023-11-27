import { createFeatureSelector, createSelector } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";

// The instance to be viewed
export const VIEW_INSTANCE_STATE_NAME = 'view_instance';

// The view instance state
export const viewInstanceState = createFeatureSelector<Instance>(VIEW_INSTANCE_STATE_NAME);
// The selector
export const selectViewInstance = () => createSelector(
  viewInstanceState,
  (state: Instance) => state
);

// Updated instance state
export const UPDATE_INSTANCES_STATE_NAME = 'updated_instances'
export const updatedInstanceState = createFeatureSelector<Instance[]>(UPDATE_INSTANCES_STATE_NAME);
export const updatedInstances = () => createSelector(
  updatedInstanceState,
  (state: Instance[]) => state
)