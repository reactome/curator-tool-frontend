import { createReducer, on } from "@ngrx/store";
import { DatabaseObject } from "src/app/core/models/database-object-attribute.model";
import { DatabaseObjectActions, InstanceActions } from "./database-object.actions";
import { createEntityAdapter, EntityState } from "@ngrx/entity";
import { EMPTY } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";

export interface DatabaseObjectEntity {
  id: string;
  databaseObject: Array<DatabaseObject>;
}

export interface DatabaseObjectState extends EntityState<DatabaseObjectEntity> {
}

// The databaseObjectAdapter extends the functionality of ngrx EntityAdapter which
// contains boilerplate code for adding, removing, modifying, etc ngrx entities.
// The adpater is used in the databaseObjectReducer.
export const databaseObjectAdapter = createEntityAdapter<DatabaseObjectEntity>();

export const initialState: DatabaseObjectState = databaseObjectAdapter.getInitialState()

export const databaseObjectReducer =
  createReducer(
    initialState,
    on(DatabaseObjectActions.set, (state, { dbId, databaseObject }) => databaseObjectAdapter.addOne({
      id: dbId,
      databaseObject: databaseObject
    }, state)),
    on(DatabaseObjectActions.remove, (state, { dbIds }) => databaseObjectAdapter.removeMany(dbIds, state)),
    on(DatabaseObjectActions.modify, (state, { dbId, databaseObjectInput }) =>
      databaseObjectAdapter.updateOne(
        {
          id: dbId,
          changes: { databaseObject: databaseObjectInput }

        }, state)),
    on(DatabaseObjectActions.add, (state, { dbId, databaseObjectInput }) =>
      databaseObjectAdapter.addOne({ id: dbId, databaseObject: databaseObjectInput }, state)),
    // on(DatabaseObjectActions.checkDbidsInState, (state, {dbId}) =>
    //   state.entities[dbId]?.databaseObject || []
  )

/**
 * Reducer to handle the instance to be viewed.
 */
export const initialInstance: Instance = {dbId: 0, displayName: undefined};

export const instanceReducer = createReducer(
  initialInstance,
  on(InstanceActions.view_instance, (state, instance) => instance)
);