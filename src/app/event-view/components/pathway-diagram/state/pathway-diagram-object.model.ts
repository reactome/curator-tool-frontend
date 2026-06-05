import { DiagramLock } from 'src/app/core/models/reactome-instance.model';

export interface PathwayDiagramObject {
  network: any;
  pathwayDiagramDbId: number;
  pathwayDbId: number;
  diagramLock: DiagramLock;
}

export interface PathwayDiagramObjects {
  pathwayDiagramObjects: PathwayDiagramObject[];
}