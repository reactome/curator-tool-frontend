import {createFeatureSelector, createSelector} from "@ngrx/store";
import {schemaClassDataAdapter, SchemaClassDataState} from "./schema-class-table.reducers";

export const selectSchemaClassDataState =
  createFeatureSelector<SchemaClassDataState>('schemaClassDataState')

export const selectSchemaClassData = (className: string) => createSelector(
  selectSchemaClassDataState,
  (state: SchemaClassDataState) => state.entities[className]?.schemaClassData || []
)

// Select one attribute by name
export const selectAttribute = (className:string, attributeName: string) =>
  createSelector(
    selectSchemaClassDataState,
    (state: SchemaClassDataState) => state.entities[className]?.schemaClassData.filter(d => d.name === attributeName)) || [];

export const hasBeenFetched = (className: string) => createSelector(selectSchemaClassDataState, (state) => (state.ids as string[]).includes(className))
