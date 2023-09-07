import {createFeatureSelector, createSelector} from "@ngrx/store";
import {attributeDataAdapter, AttributeDataState} from "./attribute-table.reducers";

export const selectAttributeDataState =
  createFeatureSelector<AttributeDataState>('attributeDataState')

export const selectAttributeData = (className: string) => createSelector(
  selectAttributeDataState,
  (state: AttributeDataState) => state.entities[className]?.attributeData || []
)

// Select one attribute by name
export const selectAttribute = (className:string, attributeName: string) =>
  createSelector(
    selectAttributeDataState,
    (state: AttributeDataState) => state.entities[className]?.attributeData.filter(d => d.name === attributeName)) || [];

export const hasBeenFetched = (className: string) => createSelector(selectAttributeDataState, (state) => (state.ids as string[]).includes(className))
