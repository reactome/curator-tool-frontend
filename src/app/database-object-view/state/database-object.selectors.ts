import {createFeatureSelector, createSelector, Store} from "@ngrx/store";
import {DatabaseObjectState} from "./database-object.reducers"
import {selectAttributeDataState} from "src/app/attribute-table/state/attribute-table.selectors";
import {SchemaClassData, toDataType} from "src/app/core/models/schema-class-entry-data.model";
import {toClassName} from "src/app/core/models/schema-class-attribute-data.model";
import {combineLatest, filter, map, tap, zip} from "rxjs";
import {AttributeDataState} from "../../attribute-table/state/attribute-table.reducers";

// The current state of the databaseObject store
export const selectDatabaseObjectState =
  createFeatureSelector<DatabaseObjectState>('databaseObjectState')

// selector for the data of one databaseObject in the store.
// using ngrx entity: multiple databaseObjects are in the databaseObject store
// as {id: dbId, entity: databaseObject[]}
// use dbId to select databaseObject info
export const selectDatabaseObjectData = (dbId: string) => createSelector(
  selectDatabaseObjectState,
  (state: DatabaseObjectState) => state.entities[dbId]?.databaseObject || []
)

// Select one attribute by name from a single databaseObject instance
export const selectDatabaseObjectAttribute = (attributeName: string, dbId: string) => createSelector(
  selectDatabaseObjectState,
  (state: DatabaseObjectState) => state.entities[dbId]?.databaseObject.filter(
    d => d.key === attributeName))

// Combine the attribute information from a schema class with a databaseObject instance of
// that schema clas.
export const selectSchemaClassArray = (store: Store, dbId: string) => combineLatest([
  store.select(selectAttributeDataState),
  store.select(selectDatabaseObjectState)
]).pipe(
  map(([attributes, entries]) => {
    const entriesMap = new Map(entries.entities[dbId]?.databaseObject.map(e => [e.key, e.value]));
    let className = toClassName(entriesMap.get("@JavaClass") as string);
    return {attributes, entries, entriesMap, className}
  }),
  // Filter to check if the attribute value is already in the store
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

// select attributes for a schema class in the format of a schema-class-entry so that
// the model is ready to be populated with user info as a new database Object instance.
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
//   selectDatabaseObjectState,
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
