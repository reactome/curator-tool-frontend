import { createReducer, on } from "@ngrx/store";
import { AttributeData } from "src/app/core/models/schema-class-attribute-data.model";
import { setAttributeData } from "./attribute-table.actions";

export interface AttributeDataState {
    attributeData: Array<AttributeData>;
}

export const initialState: AttributeDataState = {
    attributeData: []
}

export const attributeTableReducer =
createReducer(
    initialState,
    on(setAttributeData, (state, {attributeData}) =>
    {return {...state, attributeData}}),
);
