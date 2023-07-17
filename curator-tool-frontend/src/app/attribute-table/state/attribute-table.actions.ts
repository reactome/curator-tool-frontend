import { createAction, props } from "@ngrx/store";
import { AttributeData } from "src/app/core/models/schema-class-attribute-data.model";

export enum AttributeTableActions {
  GET_ATTRIBUTE_DATA = '[Attribute-Data] Get Attribute-Data',
  SET_ATTRIBUTE_DATA = '[Attribute-Data] Set Attribute-Data',
}
export const getAttributeDataList = createAction(
  AttributeTableActions.GET_ATTRIBUTE_DATA,
  props<{className: string}>(),
);
export const setAttributeData = createAction(
  AttributeTableActions.SET_ATTRIBUTE_DATA,
  props<{ attributeData: Array<AttributeData>}>(),
);
