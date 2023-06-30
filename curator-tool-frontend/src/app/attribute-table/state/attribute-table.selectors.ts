import { createFeatureSelector, createSelector } from "@ngrx/store";
import { AttributeDataState } from "./attribute-table.reducers";

export  const selectAttributeDataState = 
createFeatureSelector<AttributeDataState>('attributeDataState')

export const selectAttributeData = () => createSelector(
    selectAttributeDataState,
    (state: AttributeDataState) => state.attributeData
)

// Select one attribute by name
export const selectAttribute = (attributeName: string) => 
createSelector(
    selectAttributeDataState,
    (state: AttributeDataState) => state.attributeData.filter(d => d.name === attributeName ))