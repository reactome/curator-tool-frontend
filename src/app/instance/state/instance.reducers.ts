import { EntityState, createEntityAdapter } from "@ngrx/entity";
import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import {DeleteInstanceActions, UpdateInstanceActions, NewInstanceActions, DefaultPersonActions} from "./instance.actions";

/**
 * Reducer to handle registration of updated instance
 */
export interface UpdatedInstanceState extends EntityState<Instance> {
}

export const updatedInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const updatedInstancesReducer = createReducer(
  updatedInstancesAdaptor.getInitialState(),
  on(UpdateInstanceActions.register_updated_instance,
    UpdateInstanceActions.ls_register_updated_instance,
    (state, instance) => updatedInstancesAdaptor.upsertOne(instance, state),
  ),
  on(UpdateInstanceActions.remove_updated_instance,
     UpdateInstanceActions.ls_remove_updated_instance,
     (state, instance) => updatedInstancesAdaptor.removeOne(instance.dbId, state)
  ),
  on(UpdateInstanceActions.reset_updated_instance,
     UpdateInstanceActions.ls_reset_updated_instance,
    (state, instance) => updatedInstancesAdaptor.removeOne(instance.instance.dbId, state)
 ),
  on(UpdateInstanceActions.set_updated_instances,
    (state, {instances}) => updatedInstancesAdaptor.setAll(instances, state)
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
    NewInstanceActions.ls_register_new_instance,
    (state, instance) => newInstancesAdaptor.upsertOne(instance, state)
  ),
  on(NewInstanceActions.remove_new_instance,
    NewInstanceActions.ls_remove_new_instance,
    (state, instance) => newInstancesAdaptor.removeOne(instance.dbId, state)
  ),
  on(NewInstanceActions.set_new_instances,
    (state, {instances}) => newInstancesAdaptor.setAll(instances, state)
  )
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
    DeleteInstanceActions.ls_register_deleted_instance,
    (state, instance) => deletedInstancesAdaptor.upsertOne(instance, state)
  ),
  on(DeleteInstanceActions.remove_deleted_instance,
    DeleteInstanceActions.ls_remove_deleted_instance,
    (state, instance) => deletedInstancesAdaptor.removeOne(instance.dbId, state)
  ),
  on(DeleteInstanceActions.set_deleted_instances,
    (state, {instances}) => deletedInstancesAdaptor.setMany(instances, state)
  )
)


/**
 * Reducer to handle default person instance
 */
export interface DefaultPersonState extends EntityState<Instance> {
}
export const defaultPersonAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})
export const defaultPersonReducer = createReducer(
  defaultPersonAdaptor.getInitialState(),
  on(DefaultPersonActions.set_default_person,
     DefaultPersonActions.ls_set_default_person,
    (state, instance) => {
      return defaultPersonAdaptor.setAll([instance], state)
    }
  )
)