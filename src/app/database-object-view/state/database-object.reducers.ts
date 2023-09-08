import {createReducer, on} from "@ngrx/store";
import {DatabaseObject} from "src/app/core/models/database-object-attribute.model";
import {DatabaseObjectActions} from "./database-object.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

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
    on(DatabaseObjectActions.set, (state, {dbId, databaseObject}) => databaseObjectAdapter.addOne({
      id: dbId,
      databaseObject: databaseObject
    }, state)),
    on(DatabaseObjectActions.remove, (state, {dbIds}) => databaseObjectAdapter.removeMany(dbIds, state)),
    on(DatabaseObjectActions.modify, (state, {dbId, databaseObjectInput}) =>
      databaseObjectAdapter.updateOne(
        {
          id: dbId,
          changes: {databaseObject: databaseObjectInput}

        }, state)),
    on(DatabaseObjectActions.add, (state, {dbId, databaseObjectInput}) =>
    databaseObjectAdapter.addOne({id: dbId, databaseObject: databaseObjectInput}, state))
  )

