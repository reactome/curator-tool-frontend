import { createReducer, on } from "@ngrx/store";
import { setSchemaClassData } from "./schema-class.actions";
import { SchemaClassData } from "src/app/core/models/schema-class.model";

export interface SchemaClassDataState {
    schemaClassData: Array<SchemaClassData>;
}

export const initialState: SchemaClassDataState = {
    schemaClassData: []
}

export const schemaClassReducer = 
createReducer(
    initialState,
    on(setSchemaClassData, (state, {schemaClassData}) => 
    {return {...state, schemaClassData}}),
);