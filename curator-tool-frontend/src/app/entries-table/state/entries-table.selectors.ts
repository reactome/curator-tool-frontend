import {createFeatureSelector, createSelector, Store} from "@ngrx/store";
import {EntriesDataState} from "./entries-table.reducers"
import {selectAttributeDataState} from "src/app/attribute-table/state/attribute-table.selectors";
import {SchemaClassData, toDataType} from "src/app/core/models/schema-class-entry-data.model";
import {toClassName} from "src/app/core/models/schema-class-attribute-data.model";
import {combineLatest, filter, map, tap, zip} from "rxjs";
import {AttributeDataState} from "../../attribute-table/state/attribute-table.reducers";

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

export const selectSchemaClassArray = (store: Store, dbId: string) => combineLatest([
  store.select(selectAttributeDataState),
  store.select(selectEntriesDataState)
]).pipe(
  map(([attributes, entries]) => {
    const entriesMap = new Map(entries.entities[dbId]?.entriesData.map(e => [e.key, e.value]));
    let className = toClassName(entriesMap.get("@JavaClass") as string);
    return {attributes, entries, entriesMap, className}
  }),
  filter(({attributes, entries, entriesMap, className}) => (attributes.ids as string[]).includes(className)),
  map(({attributes, entries, entriesMap, className}) => {
    return attributes.entities[className]?.attributeData
      .filter(attributes => attributes.properties != undefined)
      .map(attribute => ({
        ...attribute,
        value: entriesMap.get(attribute.name),
        type: toDataType(attribute.properties!),
        javaType: className
      })) || []
  }),
  tap(data => console.log(data))
);

export const selectSchemaClassAttributes = (className: string) => createSelector<any, AttributeDataState, SchemaClassData[]>(
 selectAttributeDataState,
  (attributes) => {
   return attributes.entities[className]?.attributeData
     .filter(attributes => attributes.properties != undefined)
       .map(attribute => ({
         ...attribute,
         value: null,
         type: toDataType(attribute.properties!),
         javaType: className
       })) || []
  }
)
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
