import { EntityState, createEntityAdapter } from "@ngrx/entity";
import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import {DeleteInstanceActions, InstanceActions, NewInstanceActions} from "./instance.actions";

/**
 * Reducer to handle registration of updated instance
 */
export interface UpdatedInstanceState extends EntityState<Instance> {
}

export const updatedInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const dbInstanceAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const updatedInstancesReducer = createReducer(
  updatedInstancesAdaptor.getInitialState(),
  on(InstanceActions.register_updated_instance,
    (state, instance) => updatedInstancesAdaptor.upsertOne(instance, state)
  ),
  on(InstanceActions.remove_updated_instance,
    (state, instance) => updatedInstancesAdaptor.removeOne(instance.dbId, state)
  ),
)

/**
 * Reducer to handle registration of newly created instance
 */
export interface NewInstanceState extends EntityState<Instance> {
}

export const newInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const newInstancesReducer = createReducer(
  newInstancesAdaptor.getInitialState(),
  on(NewInstanceActions.register_new_instance,
    (state, instance) => newInstancesAdaptor.upsertOne(instance, state)
  ),
  on(NewInstanceActions.remove_new_instance,
    (state, instance) => newInstancesAdaptor.removeOne(instance.dbId, state)
  ),
)

/**
 * Reducer to handle registration of updated instance
 */
export interface DeletedInstanceState extends EntityState<Instance> {
}

export const deletedInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const deletedInstancesReducer = createReducer(
  deletedInstancesAdaptor.getInitialState(),
  on(DeleteInstanceActions.register_deleted_instance,
    (state, instance) => deletedInstancesAdaptor.upsertOne(instance, state)
  ),
  on(DeleteInstanceActions.remove_deleted_instance,
    (state, instance) => deletedInstancesAdaptor.removeOne(instance.dbId, state)
  ),
)

