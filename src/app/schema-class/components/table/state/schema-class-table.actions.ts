import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

export const SchemaClassTableActions = createActionGroup({
  source: "schema_class_actions",
  events: {
    get: props<{className: string}>(),
    set: props<SchemaClass>(),
  }
})
