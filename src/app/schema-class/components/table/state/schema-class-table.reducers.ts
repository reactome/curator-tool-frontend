import {createReducer, on} from "@ngrx/store";
import {SchemaClassData} from "src/app/core/models/schema-class-attribute-data.model";
import {SchemaClassTableActions} from "./schema-class-table.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

// Defining an ngrx "entity" type where id => className and entity => attributeData
export interface SchemaClassDataEntity {
  className: string
  schemaClassData: Array<SchemaClassData>;
}

export interface SchemaClassDataState extends EntityState<SchemaClassDataEntity> {
}

// The schemaClassDataAdapter extends the functionality of ngrx EntityAdapter which
// contains boilerplate code for adding, removing, modifying, etc ngrx entities.
// The adpater is used in the attributeTableReducer.
export const schemaClassDataAdapter = createEntityAdapter<SchemaClassDataEntity>({
  selectId: entity => entity.className
});

export const initialState: SchemaClassDataState = schemaClassDataAdapter.getInitialState()

export const schemaClassTableReducer =
  createReducer(
    initialState,
    on(SchemaClassTableActions.set, (state, {
      className, schemaClassData
    }) => schemaClassDataAdapter.upsertOne(
      {className: className, schemaClassData: schemaClassData}, state)),
  );

