import { createFeatureSelector, createSelector } from "@ngrx/store";
import { EntriesDataState } from "./entries-table.reducers"
import { selectAttributeDataState } from "src/app/attribute-table/state/attribute-table.selectors";
import { SchemaClassData, toDataType } from "src/app/core/models/schema-class-entry-data.model";
import { AttributeData, toAttributeClassName } from "src/app/core/models/schema-class-attribute-data.model";
import { AttributeDataState } from "src/app/attribute-table/state/attribute-table.reducers";

export const selectEntiresDataState =
    createFeatureSelector<EntriesDataState>('entriesDataState')

export const selectEntriesData = () => createSelector(
    selectEntiresDataState,
    (state: EntriesDataState) => state.entriesData
)

// Select one attribute by name
export const selectEntry = (attributeName: string) => createSelector(
    selectEntiresDataState,
    (state: EntriesDataState) => state.entriesData.filter(d => d.key === attributeName))

export const selectSchemaClassArray = () => createSelector<any, AttributeDataState, EntriesDataState, SchemaClassData[]>(
    selectAttributeDataState,
    selectEntiresDataState,
    (attributes, entries) => {
        const entriesMap = new Map(entries.entriesData.map(e => [e.key, e.value]));
        return attributes.attributeData.map(attribute => ({
            ...attribute,
             value: entriesMap.get(attribute.name),
             type: toDataType(attribute.properties),
             className: toAttributeClassName(attribute.properties)
        }))
    }
)
