import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const UpdateInstanceActions = createActionGroup({
  source: "update_instance_actions",
  events: {
    // Record updated instances
    register_updated_instance: props<Instance>(),
    last_updated_instance: props<{attribute: string, instance: Instance}>(),
    reset_updated_instance: props<{modifiedAttributes: string[]|undefined, instance: Instance}>(),
    remove_updated_instance: props<Instance>(),

    get_updated_instances: emptyProps(),
    set_updated_instances: props<{instances: Instance[]}>(),

    // For local storage
    ls_register_updated_instance: props<Instance>(),
    ls_remove_updated_instance: props<Instance>(),
    ls_last_updated_instance: props<{attribute: string, instance: Instance}>(),
    ls_reset_updated_instance: props<{modifiedAttributes: string[], instance: Instance}>(),
  }
})

export const NewInstanceActions = createActionGroup({
  source: "new_instance_actions",
  events: {
    // Record new instances
    register_new_instance: props<Instance>(),
    // Remove a new instance
    remove_new_instance: props<Instance>(),

    // To handle local storage event to avoid infinity loop
    ls_register_new_instance: props<Instance>(),
    ls_remove_new_instance: props<Instance>(),

    get_new_instances: props<Instance>(),
    set_new_instances: props<{instances: Instance[]}>(),

    // Commit a new instance changes its dbId
    commit_new_instance: props<{oldDbId: number, newDbId: number}>()
  }
})

export const DeleteInstanceActions = createActionGroup({
  source: "delete_instance_actions",
  events: {
    // Record deleted instances
    register_deleted_instance: props<Instance>(),
    remove_deleted_instance: props<Instance>(),

    get_deleted_instances: emptyProps(),
    set_deleted_instances: props<{instances: Instance[]}>(),

    ls_register_deleted_instance: props<Instance>(),
    ls_remove_deleted_instance: props<Instance>(),
  }
})
