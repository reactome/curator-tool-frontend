import {createAction, createActionGroup, emptyProps, props} from '@ngrx/store';
import { EntryData } from 'src/app/core/models/entry-data.model';
//import {Update} from "@ngrx/entity";

export enum EntriesTableActions {
    GET_ENTRIES_DATA = '[Entries-Data] Get Entries-Data',
    SET_ENTRIES_DATA = '[Entries-Data] Set Entries-Data',
  }
  export const getEntriesDataList = createAction(
    EntriesTableActions.GET_ENTRIES_DATA,
    props<{dbId: string}>(),
  );
  export const setEntriesData = createAction(
    EntriesTableActions.SET_ENTRIES_DATA,
    props<{ dbId: string, entriesData: Array<EntryData>}>(),
  );
