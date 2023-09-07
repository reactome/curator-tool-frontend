import {createReducer, on} from "@ngrx/store";
import {AttributeData} from "src/app/core/models/schema-class-attribute-data.model";
import {AttributeTableActions} from "./attribute-table.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";

// Defining an ngrx "entity" type where id => className and entity => attributeData
export interface AttributeDataEntity {
  className: string
  attributeData: Array<AttributeData>;
}

export interface AttributeDataState extends EntityState<AttributeDataEntity> {
}

// The attributeDataAdapter extends the functionality of ngrx EntityAdapter which
// contains boilerplate code for adding, removing, modifying, etc ngrx entities.
// The adpater is used in the attributeTableReducer.
export const attributeDataAdapter = createEntityAdapter<AttributeDataEntity>({
  selectId: entity => entity.className
});

export const initialState: AttributeDataState = attributeDataAdapter.getInitialState()

export const attributeTableReducer =
  createReducer(
    initialState,
    on(AttributeTableActions.set, (state, {
      className, attributeData
    }) => attributeDataAdapter.upsertOne(
      {className: className, attributeData: attributeData}, state)),
  );

