import { AttributeDataState } from "../attribute-table/state/attribute-table.reducers";
import { DatabaseObjectState } from "../database-object-view/state/database-object.reducers";

export interface AppState {
    attributeDataState: AttributeDataState;
    databaseObjectState: DatabaseObjectState;
}
