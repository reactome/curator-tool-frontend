import {createAction, props} from '@ngrx/store';
import { SchemaClassData } from 'src/app/core/models/schema-class-entry-data.model';

export enum SchemaClassActions {
    GET_SCHEMA_CLASS_DATA = '[Schema-Class-Data] Get Schema-Class-Data',
    SET_SCHEMA_CLASS_DATA = '[Schema-Class-Data] Set Schema-Class-Data',
  }
  export const getSchemaClassList = createAction(
    SchemaClassActions.GET_SCHEMA_CLASS_DATA,
  );
  export const setSchemaClassData = createAction(
    SchemaClassActions.SET_SCHEMA_CLASS_DATA,
    props<{ schemaClassData: Array<SchemaClassData>}>(),
  );
