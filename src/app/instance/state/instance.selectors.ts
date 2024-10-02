import { createFeatureSelector, createSelector, State } from "@ngrx/store";
import {
  DeletedInstanceState,
  NewInstanceState,
  UpdatedInstanceState,
  deletedInstancesAdaptor,
  newInstancesAdaptor,
  updatedInstancesAdaptor
} from "./instance.reducers";
import { combineLatest } from "rxjs";

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

// delete instance state
export const DELETE_INSTANCES_STATE_NAME = 'delete_instances'
export const deleteInstanceState = createFeatureSelector<DeletedInstanceState>(DELETE_INSTANCES_STATE_NAME);
export const deleteInstances = () => createSelector(
  deleteInstanceState,
  (state: DeletedInstanceState) => deletedInstancesAdaptor.getSelectors().selectAll(state)
)
