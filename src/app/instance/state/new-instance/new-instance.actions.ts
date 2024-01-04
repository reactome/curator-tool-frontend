import { createActionGroup, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const NewInstanceActions = createActionGroup({
  source: "new_instance_actions",
  events: {
    // Record new instances
    register_new_instances: props<Instance>(),
    get_new_instance: props<Instance>()
  }
})
