import { EntityState, createEntityAdapter } from "@ngrx/entity";
import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import {NewInstanceActions} from "./new-instance.actions";

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
  on(NewInstanceActions.register_new_instances,
    (state, instance) => newInstancesAdaptor.upsertOne(instance, state)
  )
)
