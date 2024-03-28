// Updated instance state
import {newInstancesAdaptor, NewInstanceState} from "./new-instance.reducers";
import {createFeatureSelector, createSelector} from "@ngrx/store";

export const NEW_INSTANCES_STATE_NAME = 'new_instances'
export const newInstanceState = createFeatureSelector<NewInstanceState>(NEW_INSTANCES_STATE_NAME);
export const newInstances = () => createSelector(
  newInstanceState,
  (state: NewInstanceState) => newInstancesAdaptor.getSelectors().selectAll(state)
)
