import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const InstanceActions = createActionGroup({
  source: "instance_actions",
  events: {
    // Record updated instances
    register_updated_instance: props<Instance>(),
    remove_updated_instance: props<Instance>(),
    get_updated_instances: emptyProps(),
  }
})

export const NewInstanceActions = createActionGroup({
  source: "new_instance_actions",
  events: {
    // Record new instances
    register_new_instance: props<Instance>(),
    // Remove a new instance
    remove_new_instance: props<Instance>(),
    get_new_instance: props<Instance>()
  }
})
