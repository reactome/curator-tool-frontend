import { DiagramLock } from 'src/app/core/models/reactome-instance.model';

export interface PathwayDiagramObject {
  dbId: number;
  pathwayDiagramDbId?: number;
  nodeType: 'object' | string;
  object: any;
  displayName?: string;
  diagramLock?: DiagramLock;
}

export interface PathwayDiagramObjects {
  pathwayDiagramObjects: PathwayDiagramObject[];
}