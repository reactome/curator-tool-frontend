import {createFeatureSelector, createSelector, Store} from "@ngrx/store";
import {EntriesDataState} from "./entries-table.reducers"
import {selectAttributeDataState} from "src/app/attribute-table/state/attribute-table.selectors";
import {toDataType} from "src/app/core/models/schema-class-entry-data.model";
import {toAttributeClassName} from "src/app/core/models/schema-class-attribute-data.model";
import {map, tap, zip} from "rxjs";

export const selectEntriesDataState =
  createFeatureSelector<EntriesDataState>('entriesDataState')

export const selectEntriesData = (dbId: string) => createSelector(
  selectEntriesDataState,
  (state: EntriesDataState) => state.entities[dbId]
)

// Select one attribute by name
export const selectEntry = (attributeName: string, dbId: string) => createSelector(
  selectEntriesDataState,
  (state: EntriesDataState) => state.entities[dbId]?.entriesData.filter(
    d => d.key === attributeName))

export const selectSchemaClassArray = (store: Store, dbId: string, className: string) => zip(
  store.select(selectAttributeDataState),
  store.select(selectEntriesDataState)
).pipe(
  map(([attributes, entries]) => {
    const entriesMap = new Map(
      entries.entities[dbId]?.entriesData.map(e => [e.key, e.value]));
    return attributes.entities[className]?.attributeData.map(attribute => ({
      ...attribute,
      value: entriesMap.get(attribute.name),
      type: toDataType(attribute.properties)
    })) || []
  }),
  tap(data => console.log(data))
);
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
