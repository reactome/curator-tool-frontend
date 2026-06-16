import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, concatMap, finalize, map, Observable, of, shareReplay, take, tap, throwError } from 'rxjs';
import { defaultPerson } from 'src/app/instance/state/instance.selectors';
import { environment } from 'src/environments/environment.dev';
import { DataService } from 'src/app/core/services/data.service';
import { DiagramLock, Instance } from 'src/app/core/models/reactome-instance.model';

@Injectable()
export class DiagramEditorService {
  private diagramLocks: DiagramLock[] = [];
  private getDiagramLocksInFlight$: Observable<DiagramLock[]> | null = null;
  private fetchPathwayDiagramUrl = `${environment.ApiRoot}/fetchPathwayDiagramForPathway/`;
  private lockDiagramUrl = `${environment.ApiRoot}/lockDiagram/`;
  private unlockDiagramUrl = `${environment.ApiRoot}/unlockDiagram/`;
  private hasDiagramLockedUrl = `${environment.ApiRoot}/hasDiagramLocked/`;
  private getDiagramLocksUrl = `${environment.ApiRoot}/getDiagramLocks/`;
  private backupCyNetworkUrl = `${environment.ApiRoot}/backupCyNetwork/`;
  private uploadCyNetworkUrl = `${environment.ApiRoot}/uploadCyNetwork/`;
  private hasCyNetworkUrl = `${environment.ApiRoot}/hasCyNetwork/`;
  private hasDiagramUrl = `${environment.ApiRoot}/hasDiagram/`;
  private getCyNetworkUrl = `${environment.ApiRoot}/getCyNetwork/`;
  private loadBackupCyNetworkUrl = `${environment.ApiRoot}/loadBackupCyNetwork/`;

  constructor(
    private http: HttpClient,
    private store: Store,
    private dataService: DataService
  ) {}

  fetchPathwayDiagram(pathwayId: any): Observable<Instance> {
    return this.http.get<Instance>(this.fetchPathwayDiagramUrl + `${pathwayId}`)
      .pipe(
        map((data: Instance) => data),
        catchError((err: Error) => throwError(() => err))
      );
  }

  lockDiagram(pathwayDiagram: any): Observable<DiagramLock | null> {
    return this.http.get<DiagramLock | null>(this.lockDiagramUrl + `${pathwayDiagram}`).pipe(
      map((lock: DiagramLock | null) => {
        return lock;
      }),
      tap((lock: DiagramLock | null) => {
        if (!lock)
          return;
        this.upsertLock(lock);
      }),
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  unlockDiagram(lockInfo: DiagramLock): Observable<any> {
    return this.http.post<boolean>(this.unlockDiagramUrl, lockInfo).pipe(
      tap(() => {
        const diagramDbId = Number(lockInfo?.diagramDbId);
        this.diagramLocks = this.diagramLocks.filter(lock => Number(lock?.diagramDbId) !== diagramDbId);
      }),
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  backupCyNetwork(diagramDbId: number, networkJson: object): Observable<boolean> {
    const lockId = this.diagramLocks.find(lock => Number(lock?.diagramDbId) === Number(diagramDbId))?.lockId;
    return this.http.post<boolean>(this.backupCyNetworkUrl + diagramDbId + (lockId ? `/${lockId}` : ''), networkJson).pipe(
      catchError((error: any) => {
        const status = error?.status;
        if (status === 401)
          return of(false);
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  uploadCytoscapeNetwork(pathwayDiagramId: string | number, networkJson: object): Observable<boolean> {
    const numericId = Number(pathwayDiagramId);
    const lock = this.diagramLocks.find(candidate => Number(candidate?.diagramDbId) === numericId);
    const useBackup = !!lock;

    return this.store.select(defaultPerson()).pipe(
      take(1),
      concatMap((person: Instance[]) => {
        if (!person || person.length === 0 || person[0].dbId === undefined) {
          return this.dataService.handleErrorMessage(new Error('Cannot find the default person! Cannot upload the cytoscape network without the default person!'));
        }
        const networkToUpload = networkJson && typeof networkJson === 'object'
          ? { ...networkJson, defaultPersonId: person[0].dbId }
          : networkJson;

        if (useBackup)
          return this.backupCyNetwork(numericId, networkToUpload);

        return this.http.post<boolean>(this.uploadCyNetworkUrl + pathwayDiagramId, networkToUpload).pipe(
          tap(() => {
            this.dataService.removeInstanceInCache(parseInt(pathwayDiagramId.toString()));
          }),
          catchError((error: Error) => {
            return this.dataService.handleErrorMessage(error);
          })
        );
      })
    );
  }

  hasCytoscapeNetwork(pathwayDiagramId: any): Observable<boolean> {
    return this.http.get<boolean>(this.hasCyNetworkUrl + pathwayDiagramId).pipe(
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  hasDiagram(pathwayId: any): Observable<boolean> {
    return this.http.get<boolean>(this.hasDiagramUrl + pathwayId).pipe(
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  hasDiagramLocked(pathwayDiagramId: number): Observable<DiagramLock | null> {
    return this.http.get<DiagramLock | null>(this.hasDiagramLockedUrl + pathwayDiagramId).pipe(
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  getDiagramLocks() {
    if (this.diagramLocks.length > 0)
      return of([...this.diagramLocks]);
    if (this.getDiagramLocksInFlight$)
      return this.getDiagramLocksInFlight$;

    this.getDiagramLocksInFlight$ = this.fetchDiagramLocksFromServer().pipe(
      tap((locks: DiagramLock[]) => {
        this.diagramLocks = Array.isArray(locks) ? [...locks] : [];
      }),
      finalize(() => {
        this.getDiagramLocksInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.getDiagramLocksInFlight$;
  }

  getCytoscapeNetwork(pathwayDiagramId: any) {
    const numericId = Number(pathwayDiagramId);
    const lock = this.diagramLocks.find(candidate => Number(candidate?.diagramDbId) === numericId);
    const loadBackup = !!(lock && lock.hasBackupDiagram);
    const url = loadBackup ? this.loadBackupCyNetworkUrl : this.getCyNetworkUrl;
    return this.http.get<any>(url + pathwayDiagramId).pipe(
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  private fetchDiagramLocksFromServer(): Observable<DiagramLock[]> {
    return this.http.get<DiagramLock[]>(this.getDiagramLocksUrl).pipe(
      map((pathwayDiagramLocks: DiagramLock[]) => {
        if (!Array.isArray(pathwayDiagramLocks))
          return [];
        return pathwayDiagramLocks.filter(lock => Number.isFinite(lock?.diagramDbId) && lock.diagramDbId > 0);
      }),
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  private normalizePathwayDiagramObjects(data: any): any[] {
    const any = Array.isArray(data)
      ? data
      : data?.any ?? data?.objects ?? data?.instances ?? [];

    return any.map((item: any) => {
      if (!item)
        return item;
      const sourceObject = item.object ?? item.network ?? item.node ?? item;
      const parsedObject = typeof sourceObject === 'string'
        ? this.tryParseJson(sourceObject)
        : sourceObject;
      const rawDiagramDbId = item.pathwayDiagramDbId
        ?? item.pathwayDiagramId
        ?? item.diagramDbId
        ?? item.diagramId
        ?? item.diagramLock?.diagramDbId
        ?? item.dbId;
      const normalizedDiagramDbId = Number(rawDiagramDbId);
      const diagramDbId = Number.isFinite(normalizedDiagramDbId)
        ? normalizedDiagramDbId
        : rawDiagramDbId;
      const normalizedDiagramLock = item.diagramLock
        ? {
          ...item.diagramLock,
          diagramDbId: Number.isFinite(Number(item.diagramLock.diagramDbId))
            ? Number(item.diagramLock.diagramDbId)
            : item.diagramLock.diagramDbId
        }
        : undefined;
      const rawPathwayDbId = item.pathwayDbId
        ?? item.pathwayId
        ?? item.representedPathwayDbId
        ?? item.pathway?.dbId
        ?? item.representedPathway?.dbId;
      const normalizedPathwayDbId = Number(rawPathwayDbId);
      return {
        ...item,
        dbId: diagramDbId,
        pathwayDiagramDbId: diagramDbId,
        pathwayDbId: Number.isFinite(normalizedPathwayDbId) ? normalizedPathwayDbId : rawPathwayDbId,
        object: parsedObject,
        diagramLock: normalizedDiagramLock,
        nodeType: item.nodeType ?? item.type ?? 'object'
      } as any;
    });
  }

  private tryParseJson(content: any): any {
    if (typeof content !== 'string')
      return content;
    let parsed: any = content;
    for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
      try {
        parsed = JSON.parse(parsed);
      }
      catch {
        break;
      }
    }
    return parsed;
  }

  private upsertLock(lock: DiagramLock): void {
    const diagramDbId = Number(lock?.diagramDbId);
    if (!Number.isFinite(diagramDbId) || diagramDbId <= 0)
      return;
    const index = this.diagramLocks.findIndex(candidate => Number(candidate?.diagramDbId) === diagramDbId);
    if (index >= 0) {
      this.diagramLocks[index] = lock;
      return;
    }
    this.diagramLocks.push(lock);
  }
}
