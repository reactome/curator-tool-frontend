import { createReducer, on } from "@ngrx/store";
import { EntryData } from "src/app/core/models/entry-data.model";
import { setEntriesData } from "./entries-table.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

export interface EntriesData {
    //entriesData: Map<string, Array<EntryData>>;
  id: string;
  entriesData: Array<EntryData>;
}

export interface EntriesDataState extends EntityState<EntriesData> {
}

export const entriesDataAdapter = createEntityAdapter<EntriesData>();

export const initialState: EntriesDataState = entriesDataAdapter.getInitialState()

export const entriesTableReducer =
createReducer(
    initialState,
    on(setEntriesData, (state, { dbId, entriesData}) => entriesDataAdapter.addOne({id: dbId, entriesData: entriesData}, state))
);
