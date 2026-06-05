import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { PathwayDiagramObject } from './pathway-diagram-object.model';
import { PathwayDiagramObjectActions } from './pathway-diagram-object.actions';

export interface PathwayDiagramObjectState extends EntityState<PathwayDiagramObject> {
}

export const pathwayDiagramObjectsAdaptor = createEntityAdapter<PathwayDiagramObject>({
  selectId: pathwayDiagramObject => pathwayDiagramObject.pathwayDiagramDbId!,
});

export const pathwayDiagramObjectsReducer = createReducer(
  pathwayDiagramObjectsAdaptor.getInitialState(),
  on(
    PathwayDiagramObjectActions.register_pathway_diagram_object,
    PathwayDiagramObjectActions.ls_register_pathway_diagram_object,
    (state, pathwayDiagramObject) => pathwayDiagramObjectsAdaptor.upsertOne(pathwayDiagramObject, state)
  ),
  on(
    PathwayDiagramObjectActions.remove_pathway_diagram_object,
    PathwayDiagramObjectActions.ls_remove_pathway_diagram_object,
    (state, pathwayDiagramObject) => pathwayDiagramObjectsAdaptor.removeOne(pathwayDiagramObject.pathwayDiagramDbId!, state)
  ),
  on(
    PathwayDiagramObjectActions.reset_pathway_diagram_object,
    (state, pathwayDiagramObject) => pathwayDiagramObjectsAdaptor.removeOne(pathwayDiagramObject.pathwayDiagramDbId!, state)
  ),
  on(
    PathwayDiagramObjectActions.set_pathway_diagram_objects,
    PathwayDiagramObjectActions.ls_set_pathway_diagram_objects,
    (state, { instances }) => pathwayDiagramObjectsAdaptor.setAll(instances, state)
  )
);