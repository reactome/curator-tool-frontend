import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { PathwayDiagramObject } from './pathway-diagram-object.model';

export const PathwayDiagramObjectActions = createActionGroup({
  source: 'pathway_diagram_object_actions',
  events: {
    register_pathway_diagram_object: props<PathwayDiagramObject>(),
    remove_pathway_diagram_object: props<PathwayDiagramObject>(),
    reset_pathway_diagram_object: props<PathwayDiagramObject>(),

    get_pathway_diagram_objects: emptyProps(),
    set_pathway_diagram_objects: props<{ instances: PathwayDiagramObject[] }>(),

    ls_register_pathway_diagram_object: props<PathwayDiagramObject>(),
    ls_remove_pathway_diagram_object: props<PathwayDiagramObject>(),
    ls_set_pathway_diagram_objects: props<{ instances: PathwayDiagramObject[] }>(),
  }
});