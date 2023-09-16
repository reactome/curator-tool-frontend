import { AttributeDataState } from "../schema-class-table/state/schema-class-table.reducers";
import { DatabaseObjectState } from "../instance/state/instance.reducers";

export interface AppState {
    attributeDataState: AttributeDataState;
    databaseObjectState: DatabaseObjectState;
}
