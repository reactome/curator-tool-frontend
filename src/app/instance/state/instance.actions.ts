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
