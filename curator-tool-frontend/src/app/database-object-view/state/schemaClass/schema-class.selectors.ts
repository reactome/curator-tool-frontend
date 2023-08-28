import { createFeatureSelector, createSelector } from "@ngrx/store";
import { SchemaClassDataState } from "./schema-class.reducers";
import { selectAttributeDataState } from "src/app/attribute-table/state/attribute-table.selectors";
import { selectEntriesDataState, selectEntry } from "../database-object.selectors";

export const selectSchemaClassState =
    createFeatureSelector<SchemaClassDataState>('selectSchemaClass')

export const selectSchemaClass = () => createSelector(
    selectSchemaClassState,
    selectAttributeDataState,
    selectEntriesDataState,
    (state: SchemaClassDataState, attributes, entries) => {
        //state.schemaClassData.map()
        attributes.attributeData.map(a => a.category);
        return {

        }
    }
)
