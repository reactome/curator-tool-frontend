import {createReducer, on} from "@ngrx/store";
import {Instance} from "src/app/core/models/reactome-instance.model";
import {InstanceActions} from "./instance.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

/**
 * Reducer to handle the instance to be viewed.
 */
export const initialInstance: Instance = {dbId: 0};

export const viewInstanceReducer = createReducer(
  initialInstance,
  on(InstanceActions.view_instance, (state, instance) => instance)
);

/**
 * Reducer to handle registration of updated instance
 */
export const updatedInstances: Instance[] = [];

export interface UpdatedInstanceState extends EntityState<Instance> {

}

export const updatedInstancesAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
});
export const updatedInstancesReducer = createReducer(
  updatedInstancesAdaptor.getInitialState(),
  on(InstanceActions.register_updated_instance, (state, instance) => updatedInstancesAdaptor.upsertOne(instance, state))
);

//   {
//     // Check based on dbId
//     let exists: boolean = false;
//     for (let tmp of state) {
//       if (tmp.dbId === instance.dbId) {
//         exists = true;
//         break;
//       }
//     }
//     if (exists) return state;
//     return [...state, instance]
//   }
//   )
