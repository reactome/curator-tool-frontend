import {createReducer, on} from "@ngrx/store";
import {SchemaClass} from "../../../../../core/models/reactome-schema.model";
import {SchemaClassTableActions} from "./schema-class-table.actions";

/**
 * Reducer to handle the schema class table
 */
export const initialState: SchemaClass = {name: ''}; // A real empty state

export const schemaClassTableReducer= createReducer(
    initialState,
    on(SchemaClassTableActions.set, (state, schemaClass) => schemaClass)
  );
