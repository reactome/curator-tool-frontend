import { createFeatureSelector, createSelector } from "@ngrx/store";
import { UpdatedInstanceState, updatedInstancesAdaptor } from "./instance.reducers";

// Updated instance state
export const UPDATE_INSTANCES_STATE_NAME = 'updated_instances'
export const updatedInstanceState = createFeatureSelector<UpdatedInstanceState>(UPDATE_INSTANCES_STATE_NAME);
export const updatedInstances = () => createSelector(
  updatedInstanceState,
  (state: UpdatedInstanceState) => updatedInstancesAdaptor.getSelectors().selectAll(state)
)


