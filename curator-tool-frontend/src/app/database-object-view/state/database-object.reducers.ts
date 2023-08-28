import { createReducer, on } from "@ngrx/store";
import { DatabaseObject } from "src/app/core/models/database-object.model";
import {DatabaseObjectActions} from "./database-object.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

export interface DatabaseObjectEntity {
  id: string;
  databaseObject: Array<DatabaseObject>;
}

export interface DatabaseObjectState extends EntityState<DatabaseObjectEntity> {
}

export const databaseObjectAdapter = createEntityAdapter<DatabaseObjectEntity>();

export const initialState: DatabaseObjectState = databaseObjectAdapter.getInitialState()

export const databaseObjectReducer =
createReducer(
    initialState,
    on(DatabaseObjectActions.set, (state, { dbId, databaseObject}) => databaseObjectAdapter.addOne({id: dbId, databaseObject: databaseObject}, state)),
    on(DatabaseObjectActions.remove, (state, { dbIds}) => databaseObjectAdapter.removeMany(dbIds, state))
);
