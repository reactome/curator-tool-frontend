import {createFeatureSelector, createSelector, Store} from "@ngrx/store";
import {EntriesDataState} from "./entries-table.reducers"
import {selectAttribute, selectAttributeDataState} from "src/app/attribute-table/state/attribute-table.selectors";
import {SchemaClassData, toDataType} from "src/app/core/models/schema-class-entry-data.model";
import {AttributeData, toAttributeClassName} from "src/app/core/models/schema-class-attribute-data.model";
import {AttributeDataState} from "src/app/attribute-table/state/attribute-table.reducers";
import {map, zip} from "rxjs";

export const selectEntriesDataState =
  createFeatureSelector<EntriesDataState>('entriesDataState')

export const selectEntriesData = () => createSelector(
  selectEntriesDataState,
  (state: EntriesDataState) => state.entriesData
)

// Select one attribute by name
export const selectEntry = (attributeName: string) => createSelector(
  selectEntriesDataState,
  (state: EntriesDataState) => state.entriesData.filter(d => d.key === attributeName))

export const selectSchemaClassArray = (store: Store) => zip(
  store.select(selectAttributeDataState),
  store.select(selectEntriesDataState)
).pipe(map(([attributes, entries]) => {
  console.log(entries);
  const entriesMap = new Map(entries.entriesData.map(e => [e.key, e.value]));
  return attributes.attributeData.map(attribute => ({
    ...attribute,
    value: entriesMap.get(attribute.name),
    type: toDataType(attribute.properties),
    className: toAttributeClassName(attribute.properties)
  }))
}));
// export const selectSchemaClassArray = () => createSelector<any, AttributeDataState, EntriesDataState, SchemaClassData[]>(
//   selectAttributeDataState,
//   selectEntriesDataState,
//   (attributes, entries) => {
//     console.log(attributes, entries)
//     const entriesMap = new Map(entries.entriesData.map(e => [e.key, e.value]));
//     return attributes.attributeData.map(attribute => ({
//       ...attribute,
//       value: entriesMap.get(attribute.name),
//       type: toDataType(attribute.properties),
//       className: toAttributeClassName(attribute.properties)
//     }))
//   }
// )
