import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {AttributeData} from "src/app/core/models/schema-class-attribute-data.model";

export const AttributeTableActions = createActionGroup({
  source: "Attribute-Data",
  events: {
    get: props<{ className: string }>(),
    set: props<{ className: string, attributeData: Array<AttributeData> }>()
  }
})
