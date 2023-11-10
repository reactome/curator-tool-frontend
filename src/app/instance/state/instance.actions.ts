import { createActionGroup, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const InstanceActions = createActionGroup({
  source: "instance_actions",
  events: {
    get_instance: props<{dbId: number}>(),
    view_instance: props<Instance>(),
  }
})
