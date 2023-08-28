import { AttributeDataState } from "../attribute-table/state/attribute-table.reducers";
import { EntriesDataState } from "../database-object-view/state/database-object.reducers";

export interface AppState {
    attributeDataState: AttributeDataState;
    entriesDataState: EntriesDataState;
}
