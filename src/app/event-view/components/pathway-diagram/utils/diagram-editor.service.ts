import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, finalize, forkJoin, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { DataService } from 'src/app/core/services/data.service';
import { DiagramLock, Instance } from 'src/app/core/models/reactome-instance.model';

export interface DiagramLockViewModel {
  diagramDbId: number;
  lockId: string;
  lockedAt: string;
  displayName: string;
  hasBackupDiagram?: boolean;
  pathwayDbId?: number;
}

export interface DiagramLockedDialogData {
  title: string;
  message: string;
  instanceInfo: string;
}

export type DiagramLoadPlan =
  | { mode: 'cy'; elements: any }
  | { mode: 'diagram' }
  | { mode: 'empty' };

@Injectable()
export class DiagramEditorService implements OnDestroy {
  private diagramLocks: DiagramLock[] = [];
  private readonly lockCacheRevision$ = new BehaviorSubject<number>(0);

  private getDiagramLocksInFlight$: Observable<DiagramLock[]> | null = null;
  private readonly diagramLocksStorageKey = 'diagramLocks';
  
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
    private dataService: DataService
  ) {
    // Don't call this. We will use the server data when the browser starts.
    //this.syncLocksFromLocalStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorageEvent);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorageEvent);
    }
  }

  fetchPathwayDiagram(pathwayId: any): Observable<Instance> {
    return this.http.get<Instance>(this.fetchPathwayDiagramUrl + `${pathwayId}`)
      .pipe(
        map((data: Instance) => data),
        catchError((err: Error) => throwError(() => err))
      );
  }

  lockDiagram(pathwayDiagramId: number | string): Observable<DiagramLock | null> {
    return this.http.get<DiagramLock | null>(this.lockDiagramUrl + `${pathwayDiagramId}`).pipe(
      map((lock: DiagramLock | null) => {
        return lock;
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
        this.setDiagramLocks(this.diagramLocks.filter(lock => Number(lock?.diagramDbId) !== diagramDbId));
      }),
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  getCachedDiagramLock(pathwayDiagramId: string | number | undefined): DiagramLock | null {
    if (!pathwayDiagramId)      return null;
    const numericId = Number(pathwayDiagramId);
    if (!Number.isFinite(numericId) || numericId <= 0)
      return null;
    return this.diagramLocks.find(candidate => Number(candidate?.diagramDbId) === numericId) || null;
  }

  shouldRunPeriodicBackup(reason: string, lastBackupAtMs: number, backupIntervalMs: number): boolean {
    if (reason !== 'periodic autosave')
      return true;
    if (lastBackupAtMs <= 0)
      return true;
    const elapsedMs = Date.now() - lastBackupAtMs;
    return elapsedMs >= backupIntervalMs;
  }

  acquireEditingLock(pathwayDiagramId: number): Observable<DiagramLock | undefined> {
    // Check if this user has the diagram locked already. If so, return the lock info from cache directly. Otherwise, make a request to server to acquire the lock.
    let lockInfo = this.getCachedDiagramLock(pathwayDiagramId);
    if (lockInfo) {
      return of(lockInfo); // The user has the lock already, return the lock info from cache.
    }
    return this.hasDiagramLocked(pathwayDiagramId).pipe(
      switchMap((existingLock: DiagramLock | null) => {
        if (existingLock) { // Means this diagram is locked by someone else.
          return of(existingLock); // Don't care if that user is the current user or not.
        }

        return this.lockDiagram(pathwayDiagramId).pipe(
          map((acquiredLock: DiagramLock | null) => {
            if (!acquiredLock) {
              return undefined;
            }

            // Keep local owned-lock cache in sync after successful lock acquisition.
            this.upsertLock(acquiredLock);
            return acquiredLock;
          })
        );
      })
    );
  }

  resolveEditingLoadPlan(pathwayDiagramId: string, lockInfo: DiagramLock): Observable<DiagramLoadPlan> {
    if (lockInfo.hasBackupDiagram) {
      return this.getCytoscapeNetwork(pathwayDiagramId).pipe(
        switchMap((backupNetwork: any) => {
          if (backupNetwork && backupNetwork.elements)
            return of({ mode: 'cy', elements: backupNetwork.elements } as DiagramLoadPlan);
          return this.resolvePrimaryLoadPlan(pathwayDiagramId);
        }),
        catchError(() => this.resolvePrimaryLoadPlan(pathwayDiagramId))
      );
    }
    return this.resolvePrimaryLoadPlan(pathwayDiagramId);
  }

  resolvePrimaryLoadPlan(pathwayDiagramId: string | number): Observable<DiagramLoadPlan> {
    const diagramId = `${pathwayDiagramId}`;
    const diagramOrEmpty$ = this.hasDiagram(diagramId).pipe(
      map((hasDiagramJson: boolean) => hasDiagramJson ? ({ mode: 'diagram' } as DiagramLoadPlan) : ({ mode: 'empty' } as DiagramLoadPlan))
    );
    return this.hasCytoscapeNetwork(diagramId).pipe(
      switchMap((hasCyNetwork: boolean) => {
        if (!hasCyNetwork)
          return diagramOrEmpty$;

        return this.getCytoscapeNetwork(diagramId).pipe(
          switchMap((cytoscapeJson: any) => {
            if (cytoscapeJson && cytoscapeJson.elements)
              return of({ mode: 'cy', elements: cytoscapeJson.elements } as DiagramLoadPlan);
            return diagramOrEmpty$;
          }),
          catchError(() => diagramOrEmpty$)
        );
      })
    );
  }

  backupCyNetwork(pathwayDiagramId: string | number | undefined, networkJson: object): Observable<boolean> {
    if (!pathwayDiagramId)
      return of(false);
    const diagramDbId = Number(pathwayDiagramId);
    const existingLock = this.diagramLocks.find(lock => Number(lock?.diagramDbId) === diagramDbId);
    const lockId = existingLock?.lockId;
    return this.http.post<boolean>(this.backupCyNetworkUrl + pathwayDiagramId + (lockId ? `/${lockId}` : ''), networkJson).pipe(
      tap((saved: boolean) => {
        if (!saved || !existingLock)
          return;

        this.upsertLock({
          ...existingLock,
          hasBackupDiagram: true
        });
      }),
      catchError((error: any) => {
        const status = error?.status;
        if (status === 401)
          return of(false);
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  uploadCytoscapeNetwork(pathwayDiagramId: string | number,
    networkJson: object,
    defaultPersonId: number): Observable<boolean> {
    const networkToUpload = networkJson && typeof networkJson === 'object'
      ? { ...networkJson, defaultPersonId: defaultPersonId }
      : networkJson;

    return this.http.post<boolean>(this.uploadCyNetworkUrl + pathwayDiagramId, networkToUpload).pipe(
      tap(() => {
        // Clear the cache for this pathway diagram so that next time when users open it, it will fetch the latest one from server due to some changes have been made at the server side after uploading the network json.
        this.dataService.removeInstanceInCache(parseInt(pathwayDiagramId.toString()));
        const lockInfo = this.getCachedDiagramLock(pathwayDiagramId);
        if (lockInfo) {
          lockInfo.hasBackupDiagram = false;
          this.upsertLock(lockInfo);
        }
      }),
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
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

  /**
   * Check the server is this pathway diagram is locked by another user or not. If it is locked, return the lock information, otherwise return null.
   * @param pathwayDiagramId 
   * @returns 
   */
  hasDiagramLocked(pathwayDiagramId: number): Observable<DiagramLock | null> {
    return this.http.get<DiagramLock | null>(this.hasDiagramLockedUrl + pathwayDiagramId).pipe(
      catchError((error: Error) => {
        return this.dataService.handleErrorMessage(error);
      })
    );
  }

  /**
   * Check if this pathway diagram is locked by the current user or not. If it is locked by the current user, return true, otherwise return false.
   * @param pathwayDiagramId 
   * @returns 
   */
  isDiagramLockedByMe(pathwayDiagramId: number | string | undefined): boolean {
    if (!pathwayDiagramId)
      return false;
    const lock = this.diagramLocks.find(candidate => Number(candidate?.diagramDbId) === Number(pathwayDiagramId));
    return !!lock;
  }


  getDiagramLocks() {
    if (this.diagramLocks.length > 0)
      return of([...this.diagramLocks]);
    if (this.getDiagramLocksInFlight$)
      return this.getDiagramLocksInFlight$;

    this.getDiagramLocksInFlight$ = this.fetchDiagramLocksFromServer().pipe(
      tap((locks: DiagramLock[]) => {
        this.setDiagramLocks(Array.isArray(locks) ? [...locks] : []);
      }),
      finalize(() => {
        this.getDiagramLocksInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.getDiagramLocksInFlight$;
  }

  buildDiagramLockedDialogData(lockInfo: DiagramLock | null | undefined): DiagramLockedDialogData {
    const owner = lockInfo?.username && lockInfo.username.length > 0 ? lockInfo.username : 'another user';
    const lockedAtLine = lockInfo?.lockedAt && lockInfo.lockedAt.length > 0
      ? `Locked at: ${lockInfo.lockedAt} (UTC).`
      : 'Locked at: unavailable';
    const message = lockInfo
      ? `This pathway diagram is currently locked by user "${owner}".`
      : 'This pathway diagram is currently locked by another user.';
    return {
      title: 'Diagram Locked',
      message: message,
      instanceInfo: lockedAtLine
    };
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

  loadPathwayDiagramLocksViewModels(): Observable<DiagramLockViewModel[]> {
    return this.getDiagramLocks().pipe(
      map((locks: DiagramLock[]) => (locks || []).filter((lock: DiagramLock) => Number(lock?.diagramDbId) > 0)),
      switchMap((validLocks: DiagramLock[]) => {
        if (validLocks.length === 0)
          return of([] as DiagramLockViewModel[]);

        const requests = validLocks.map((lock: DiagramLock) =>
          this.dataService.fetchInstance(Number(lock.diagramDbId)).pipe(
            map((diagramInst: Instance) => this.toDiagramLockViewModel(lock, diagramInst)),
            catchError(() => of(this.toDiagramLockFallbackViewModel(lock)))
          )
        );
        return forkJoin(requests);
      }),
      map((items: DiagramLockViewModel[]) => (items || []).sort((a, b) => {
        const aTime = new Date(a.lockedAt || '').getTime();
        const bTime = new Date(b.lockedAt || '').getTime();
        return bTime - aTime;
      }))
    );
  }

  observePathwayDiagramLocksViewModels(): Observable<DiagramLockViewModel[]> {
    return this.lockCacheRevision$.pipe(
      switchMap(() => this.loadPathwayDiagramLocksViewModels())
    );
  }

  observeDiagramLocks(): Observable<DiagramLock[]> {
    return this.lockCacheRevision$.pipe(
      map(() => [...this.diagramLocks])
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

  private getStoredDiagramLocks(): DiagramLock[] {
    if (typeof localStorage === 'undefined')
      return [];

    const raw = localStorage.getItem(this.diagramLocksStorageKey);
    if (!raw)
      return [];

    try {
      const parsed = JSON.parse(raw);
      return this.normalizeDiagramLocks(parsed);
    }
    catch {
      return [];
    }
  }

  private toDiagramLockViewModel(lock: DiagramLock, diagramInst: Instance): DiagramLockViewModel {
    let represented = diagramInst?.attributes instanceof Map
      ? diagramInst.attributes.get('representedPathway')
      : diagramInst?.attributes?.representedPathway;

    let pathwayDbId: number | undefined = undefined;
    if (Array.isArray(represented) && represented.length > 0 && represented[0]?.dbId)
      pathwayDbId = Number(represented[0].dbId);

    return {
      diagramDbId: Number(lock.diagramDbId),
      lockId: lock.lockId,
      lockedAt: lock.lockedAt,
      displayName: diagramInst?.displayName || `PathwayDiagram ${lock.diagramDbId}`,
      hasBackupDiagram: !!lock.hasBackupDiagram,
      pathwayDbId: pathwayDbId
    };
  }

  private toDiagramLockFallbackViewModel(lock: DiagramLock): DiagramLockViewModel {
    return {
      diagramDbId: Number(lock.diagramDbId),
      lockId: lock.lockId,
      lockedAt: lock.lockedAt,
      hasBackupDiagram: !!lock.hasBackupDiagram,
      displayName: `PathwayDiagram ${lock.diagramDbId}`
    };
  }

  private upsertLock(lock: DiagramLock): void {
    const diagramDbId = Number(lock?.diagramDbId);
    if (!Number.isFinite(diagramDbId) || diagramDbId <= 0)
      return;
    const index = this.diagramLocks.findIndex(candidate => Number(candidate?.diagramDbId) === diagramDbId);
    if (index >= 0) {
      const updatedLocks = [...this.diagramLocks];
      updatedLocks[index] = lock;
      this.setDiagramLocks(updatedLocks);
      return;
    }
    this.setDiagramLocks([...this.diagramLocks, lock]);
  }

  private setDiagramLocks(locks: DiagramLock[]): void {
    this.diagramLocks = this.normalizeDiagramLocks(locks);
    this.persistDiagramLocks();
    this.emitLockCacheRevision();
  }


  private persistDiagramLocks(): void {
    if (typeof localStorage === 'undefined')
      return;
    try {
      // The tab itself will not get the storage event when it updates the localStorage, so we can directly update the localStorage without worrying about duplicate updates from storage event handler.
      localStorage.setItem(this.diagramLocksStorageKey, JSON.stringify(this.diagramLocks));
    }
    catch {
      // Ignore localStorage write failures (quota/privacy mode).
    }
  }

  private normalizeDiagramLocks(value: any): DiagramLock[] {
    if (!Array.isArray(value))
      return [];

    return value
      .filter((item: any) => Number.isFinite(Number(item?.diagramDbId)) && Number(item.diagramDbId) > 0)
      .map((item: any) => ({
        ...item,
        diagramDbId: Number(item.diagramDbId)
      } as DiagramLock));
  }

  private readonly onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== this.diagramLocksStorageKey)
      return;

    let nextLocks: DiagramLock[] = [];
    try {
      nextLocks = this.normalizeDiagramLocks(event.newValue ? JSON.parse(event.newValue) : []);
    }
    catch {
      nextLocks = [];
    }

    const hasChanged = JSON.stringify(nextLocks) !== JSON.stringify(this.diagramLocks);
    if (!hasChanged)
      return;

    this.diagramLocks = nextLocks;
    this.emitLockCacheRevision();
  };

  private emitLockCacheRevision(): void {
    this.lockCacheRevision$.next(this.lockCacheRevision$.value + 1);
  }
}
