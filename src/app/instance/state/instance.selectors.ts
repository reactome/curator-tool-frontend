import { createFeatureSelector, createSelector } from "@ngrx/store";
import { NewInstanceState, UpdatedInstanceState, newInstancesAdaptor, updatedInstancesAdaptor } from "./instance.reducers";

// Updated instance state
export const UPDATE_INSTANCES_STATE_NAME = 'updated_instances'
export const updatedInstanceState = createFeatureSelector<UpdatedInstanceState>(UPDATE_INSTANCES_STATE_NAME);
export const updatedInstances = () => createSelector(
  updatedInstanceState,
  (state: UpdatedInstanceState) => updatedInstancesAdaptor.getSelectors().selectAll(state)
)

// new instance state
export const NEW_INSTANCES_STATE_NAME = 'new_instances'
export const newInstanceState = createFeatureSelector<NewInstanceState>(NEW_INSTANCES_STATE_NAME);
export const newInstances = () => createSelector(
  newInstanceState,
  (state: NewInstanceState) => newInstancesAdaptor.getSelectors().selectAll(state)
)