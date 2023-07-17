import { AttributeDataState } from "../attribute-table/state/attribute-table.reducers";
import { EntriesDataState } from "../entries-table/state/entries-table.reducers";

export interface AppState {
    attributeDataState: AttributeDataState;
    entriesDataState: EntriesDataState;
}
