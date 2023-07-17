import { createReducer, on } from "@ngrx/store";
import { EntryData } from "src/app/core/models/entry-data.model";
import { setEntriesData } from "./entries-table.actions";

export interface EntriesDataState {
    entriesData: Array<EntryData>;
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
