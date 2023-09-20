import { createFeatureSelector, createSelector } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";

// The instance to be viewed
export const VIEW_INSTANCE_STATE_NAME = 'view_instance';
// Newly created instance
export const NEW_INSTANCE_STATE_NAME = 'new_instance';

// The view instance state
export const viewInstanceState = createFeatureSelector<Instance>(VIEW_INSTANCE_STATE_NAME);
// The selector
export const selectViewInstance = () => createSelector(
  viewInstanceState,
  (state: Instance) => state
);

// The new instance state
export const newInstanceState = createFeatureSelector<Instance>(NEW_INSTANCE_STATE_NAME);
// The selector
export const selectNewInstance = () => createSelector(
  newInstanceState,
  (state: Instance) => state
)