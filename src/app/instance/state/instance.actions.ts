import {createActionGroup, props} from '@ngrx/store';
import {DatabaseObject} from 'src/app/core/models/database-object-attribute.model';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const DatabaseObjectActions = createActionGroup({
  source: "Database-Object-Data",
  events: {
    get: props<{ dbId: string }>(),
    'check dbIds in state': props<{dbId: string}>(),
    set: props<{ dbId: string, databaseObject: Array<DatabaseObject> }>(),
    remove: props<{ dbIds: string[] }>(),
    modify: props<{ dbId: string, databaseObjectInput: Array<DatabaseObject> }>(),
    add: props<{ dbId: string, databaseObjectInput: Array<DatabaseObject> }>()
  }
})

export const InstanceActions = createActionGroup({
  source: "instance_actions",
  events: {
    get_instance: props<{dbId: number}>(),
    view_instance: props<Instance>(),
  }
})
