import { createReducer, on } from "@ngrx/store";
import { KeyValuePair } from "src/app/core/models/key-value.model";
import { setEntriesData } from "./entries-table.actions";

export interface EntriesDataState {
    entriesData: Array<KeyValuePair>;
}

export const initialState: EntriesDataState = {
    entriesData: []
}

export const entriesTableReducer = 
createReducer(
    initialState,
    on(setEntriesData, (state, {entriesData}) => 
    {return {...state, entriesData}}),
);