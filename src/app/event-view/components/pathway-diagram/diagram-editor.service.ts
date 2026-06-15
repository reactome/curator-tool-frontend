import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataService } from 'src/app/core/services/data.service';
import { DiagramLock } from 'src/app/core/models/reactome-instance.model';

@Injectable({ providedIn: 'root' })
export class DiagramEditorService {
  constructor(private dataService: DataService) {}

  lockDiagram(pathwayDiagram: any): Observable<DiagramLock | null> {
    return this.dataService.lockDiagram(pathwayDiagram);
  }

  unlockDiagram(lockInfo: DiagramLock): Observable<any> {
    return this.dataService.unlockDiagram(lockInfo);
  }

  backupCyNetwork(diagramDbId: number, networkJson: object): Observable<any> {
    return this.dataService.backupCyNetwork(diagramDbId, networkJson);
  }

  uploadCytoscapeNetwork(pathwayDiagramId: string | number, networkJson: object): Observable<boolean> {
    return this.dataService.uploadCytoscapeNetwork(pathwayDiagramId, networkJson);
  }

  hasCytoscapeNetwork(pathwayDiagramId: any): Observable<boolean> {
    return this.dataService.hasCytoscapeNetwork(pathwayDiagramId);
  }

  getDiagramLocks() {
    return this.dataService.getDiagramLocks();
  }

  getCytoscapeNetwork(pathwayDiagramId: any) {
    return this.dataService.getCytoscapeNetwork(pathwayDiagramId);
  }
}
