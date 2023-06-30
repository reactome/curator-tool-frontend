import { createFeatureSelector, createSelector } from "@ngrx/store";
import { EntriesDataState } from "./entries-table.reducers"
import { selectAttributeDataState } from "src/app/attribute-table/state/attribute-table.selectors";
import { SchemaClassData, SchemaTableData } from "src/app/core/models/schema-class.model";

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

//  const selectSchemaClassArray =createSelector(
//     selectAttributeDataState,
//     selectEntiresDataState,
//     (attributes, entries) = >{
//         let schemaClassArray: SchemaClassData[] = [];

//     }
// )

export const selectSchemaClassArray = () => createSelector(
    selectAttributeDataState,
    selectEntiresDataState,
    (attributes, entries) => {
        let schemaClassArray: SchemaClassData[] = [];
        attributes.attributeData.forEach((attribute) => {

            if (entries.entriesData.filter(e => e.key === attribute.name)){

            let schemaClassDataObject = new SchemaTableData(
            attribute.category,
            attribute.definingType,
            attribute.name,
            attribute.properties,
            entries.entriesData.filter(e => e.key === attribute.name)
            )
            schemaClassArray.push(schemaClassDataObject);
            }
            else {
                let schemaClassDataObject = new SchemaTableData(
                    attribute.category,
                    attribute.definingType,
                    attribute.name,
                    attribute.properties,
                    undefined)
                    schemaClassArray.push(schemaClassDataObject);
            }
    
        });
return schemaClassArray

    } 
)

//entries.entriesData.filter(e => e.key === attribute.name)[0].value