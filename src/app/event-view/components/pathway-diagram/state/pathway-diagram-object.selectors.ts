import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PathwayDiagramObjectState, pathwayDiagramObjectsAdaptor } from './pathway-diagram-object.reducers';

export const PATHWAY_DIAGRAM_OBJECTS_STATE_NAME = 'pathway_diagram_objects';

export const pathwayDiagramObjectState = createFeatureSelector<PathwayDiagramObjectState>(PATHWAY_DIAGRAM_OBJECTS_STATE_NAME);

export const pathwayDiagramObjects = () => createSelector(
  pathwayDiagramObjectState,
  (state: PathwayDiagramObjectState) => pathwayDiagramObjectsAdaptor.getSelectors().selectAll(state)
);