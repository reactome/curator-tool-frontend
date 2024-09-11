import { createFeatureSelector, createSelector } from "@ngrx/store";
import {
  DeletedInstanceState,
  LastUpdatedInstanceState,
  NewInstanceState,
  UpdatedInstanceState,
  deletedInstancesAdaptor,
  newInstancesAdaptor,
  updatedInstancesAdaptor
} from "./instance.reducers";

// Updated instance state
export const UPDATE_INSTANCES_STATE_NAME = 'updated_instances'
export const updatedInstanceState = createFeatureSelector<UpdatedInstanceState>(UPDATE_INSTANCES_STATE_NAME);
export const updatedInstances = () => createSelector(
  updatedInstanceState,
  (state: UpdatedInstanceState) => updatedInstancesAdaptor.getSelectors().selectAll(state)
)

// Last updated instance
export const LAST_UPDATED_INSTANCE_STATE_NAME = "last_updated_instance"
export const lastUpdatedInstanceState = createFeatureSelector<LastUpdatedInstanceState>(LAST_UPDATED_INSTANCE_STATE_NAME);
export const lastUpdatedInstance = () => createSelector(
  lastUpdatedInstanceState,
  (state: LastUpdatedInstanceState) => state.lastInst
)

// new instance state
export const NEW_INSTANCES_STATE_NAME = 'new_instances'
export const newInstanceState = createFeatureSelector<NewInstanceState>(NEW_INSTANCES_STATE_NAME);
export const newInstances = () => createSelector(
  newInstanceState,
  (state: NewInstanceState) => newInstancesAdaptor.getSelectors().selectAll(state)
)

// delete instance state
export const DELETE_INSTANCES_STATE_NAME = 'delete_instances'
export const deleteInstanceState = createFeatureSelector<DeletedInstanceState>(DELETE_INSTANCES_STATE_NAME);
export const deleteInstances = () => createSelector(
  deleteInstanceState,
  (state: DeletedInstanceState) => deletedInstancesAdaptor.getSelectors().selectAll(state)
)
