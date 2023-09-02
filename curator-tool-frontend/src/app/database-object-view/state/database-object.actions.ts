import {createActionGroup, props} from '@ngrx/store';
import { DatabaseObject } from 'src/app/core/models/database-object.model';

// export enum DatabaseObjectActions {
//     GET_ENTRIES_DATA = '[Entries-Data] Get Entries-Data',
//     SET_ENTRIES_DATA = '[Entries-Data] Set Entries-Data',
//   }
//   export const getEntriesDataList = createAction(
//     DatabaseObjectActions.GET_ENTRIES_DATA,
//     props<{dbId: string}>(),
//   );
//   export const setEntriesData = createAction(
//     DatabaseObjectActions.SET_ENTRIES_DATA,
//     props<{ dbId: string, entriesData: Array<EntryData>}>(),
//   );

export const DatabaseObjectActions = createActionGroup({
  source: "Database-Object-Data",
  events: {
    get: props<{dbId: string}>(),
    set: props<{ dbId: string, databaseObject: Array<DatabaseObject>}>(),
    remove: props<{ dbIds: string[]}>(),
    modify: props<{ dbId: string, databaseObjectInput: Array<DatabaseObject>}>(),
    add: props<{dbId: string, databaseObjectInput: Array<DatabaseObject>}>()
  }
})
