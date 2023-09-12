import { AttributeDataState } from "../schema-class-table/state/schema-class-table.reducers";
import { DatabaseObjectState } from "../database-object-view/state/database-object.reducers";

export interface AppState {
    attributeDataState: AttributeDataState;
    databaseObjectState: DatabaseObjectState;
}
