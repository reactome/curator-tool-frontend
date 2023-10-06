import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {SchemaClass} from "../../../../core/models/reactome-schema.model";

export const SchemaClassTableActions = createActionGroup({
  source: "Schema-Class-Data",
  events: {
    get: props<{ className: string }>(),
    set: props<SchemaClass>(),
  }
})
