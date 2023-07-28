import {createReducer, on} from "@ngrx/store";
import {AttributeData} from "src/app/core/models/schema-class-attribute-data.model";
import {setAttributeData} from "./attribute-table.actions";
import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {setEntriesData} from "../../entries-table/state/entries-table.actions";
import {EntriesData} from "../../entries-table/state/entries-table.reducers";

export interface AttributeDataEntity {
  className: string
  attributeData: Array<AttributeData>;
}

export interface AttributeDataState extends EntityState<AttributeDataEntity> {
}

export const attributeDataAdapter = createEntityAdapter<AttributeDataEntity>({
  selectId: entity => entity.className
});

export const initialState: AttributeDataState = attributeDataAdapter.getInitialState()

export const attributeTableReducer =
  createReducer(
    initialState,
    on(setAttributeData, (state, { className, attributeData}) => attributeDataAdapter.upsertOne({className: className, attributeData: attributeData}, state))
  );

