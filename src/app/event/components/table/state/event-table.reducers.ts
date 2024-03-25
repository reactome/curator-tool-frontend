import {createReducer, on} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";
import {EventTableActions} from "./event-table.actions";

/**
 * Reducer to handle the schema class table
 */
export const initialState: SchemaClass = {name: ''}; // A real empty state

export const eventTableReducer= createReducer(
    initialState,
    on(EventTableActions.set, (state, event) => event)
  );
