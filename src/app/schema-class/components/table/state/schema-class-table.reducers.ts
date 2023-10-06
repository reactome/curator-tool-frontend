import {createReducer, on} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";
import {SchemaClassTableActions} from "./schema-class-table.actions";
import {newInstanceState} from "../../../../instance/state/instance.selectors";

/**
 * Reducer to handle the schema class table
 */
export const initialState: SchemaClass = newInstanceState;

export const schemaClassTableReducer= createReducer(
    initialState,
    on(SchemaClassTableActions.set, (state, schemaClassData) => schemaClassData)

  );

