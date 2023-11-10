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
