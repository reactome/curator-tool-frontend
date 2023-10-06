import {createFeatureSelector, createSelector} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

export const selectSchemaClassDataState =
  createFeatureSelector<SchemaClass>('schemaClassDataState')

export const selectSchemaClassData = (className: string) => createSelector(
  selectSchemaClassDataState,
  (state: SchemaClass) => state
)
