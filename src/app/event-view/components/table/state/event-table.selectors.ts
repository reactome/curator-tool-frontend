import {createFeatureSelector, createSelector} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

// Name of the state
export const VIEW_EVENT_STATE_NAME = "view_event"

export const viewEventState = createFeatureSelector<SchemaClass>(VIEW_EVENT_STATE_NAME)

export const getEvent = () => createSelector(
  viewEventState,
  (state: SchemaClass) => state
)
