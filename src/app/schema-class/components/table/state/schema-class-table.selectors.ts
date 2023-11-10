import {createFeatureSelector, createSelector} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

// Name of the state
export const VIEW_SCHEMA_CLASS_STATE_NAME = "view_schema_class"

export const viewSchemaClassState = createFeatureSelector<SchemaClass>(VIEW_SCHEMA_CLASS_STATE_NAME)

export const getSchemaClass = () => createSelector(
  viewSchemaClassState,
  (state: SchemaClass) => state
)
