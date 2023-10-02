import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {SchemaClassData} from "src/app/core/models/schema-class-attribute-data.model";

export const SchemaClassTableActions = createActionGroup({
  source: "Schema-Class-Data",
  events: {
    get: props<{ className: string }>(),
    set: props<{ className: string, schemaClassData: Array<SchemaClassData> }>()
  }
})
