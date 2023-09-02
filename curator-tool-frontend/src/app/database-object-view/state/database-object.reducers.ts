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
    on(DatabaseObjectActions.remove, (state, { dbIds}) => databaseObjectAdapter.removeMany(dbIds, state)),
    on(DatabaseObjectActions.modify, (state, {dbId, databaseObjectInput}) =>
    databaseObjectAdapter.updateOne(
      {
        id: dbId,
        changes: { databaseObject: databaseObjectInput}

      }, state)),
  // on(DatabaseObjectActions.add, (state, {dbId, databaseObjectInput}) =>
  // databaseObjectAdapter.addOne(databaseObjectInput, state))
)
// state.entities[dbId]?.databaseObject.find(line => {line.key === '@JavaClass'
//   line.value = databaseObjectInput; console.log('the test dbObject' + databaseObjectInput)}})
// }})
//state.entities[dbId]?.databaseObject.find(e => e.key === attribute)?.value

//   return {...state, databaseObject:
//       state.entities[dbId]?.databaseObject.filter(data => data.key === databaseObject.key)
//   {if(e.key === attribute) {e.value = databaseObjectInput; console.log('the test dbObject' + databaseObjectInput)}})
// }}
