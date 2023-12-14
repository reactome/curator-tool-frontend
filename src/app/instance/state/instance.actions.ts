import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const InstanceActions = createActionGroup({
  source: "instance_actions",
  events: {
    // Fetch and view actions
    get_instance: props<{dbId: number}>(),
    view_instance: props<Instance>(),

    // Record updated instances
    register_updated_instance: props<Instance>(),
    get_updated_instances: emptyProps(),

    // Modify instance attributes
    add_modified_attribute: props<{dbId:number; attName: string}>(),
  }
})
