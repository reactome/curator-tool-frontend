import { createFeatureSelector, createSelector } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import {updatedInstancesAdaptor, UpdatedInstanceState, DbInstanceState, dbInstanceAdaptor} from "./instance.reducers";

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
export const updatedInstanceState = createFeatureSelector<UpdatedInstanceState>(UPDATE_INSTANCES_STATE_NAME);
export const updatedInstances = () => createSelector(
  updatedInstanceState,
  (state: UpdatedInstanceState) => updatedInstancesAdaptor.getSelectors().selectAll(state)
)

// Original db Instance state
export const GET_DB_INSTANCE = 'get_db_instance'
export const getDbInstanceState = createFeatureSelector<DbInstanceState>(GET_DB_INSTANCE);
export const getDbInstance = () => createSelector(
  getDbInstanceState,
  (state: DbInstanceState) => dbInstanceAdaptor.getInitialState()
)

