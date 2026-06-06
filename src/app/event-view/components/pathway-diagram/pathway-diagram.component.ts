/**
 * This component is a wrapper of cr-diagram to provide features for editing the pathway diagram that is displayed
 * in cytoscape.
 */
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, HostListener, inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { DiagramComponent } from 'ngx-reactome-diagram';
import { combineLatest, filter, map, Observable, take } from 'rxjs';
import { EditorActionsComponent, ElementType } from './editor-actions/editor-actions.component';
import { PathwayDiagramUtilService } from './utils/pathway-diagram-utils';
import { ReactomeEvent } from 'ngx-reactome-cytoscape-style';
import { Position } from 'ngx-reactome-diagram/lib/model/diagram.model';
import { EDGE_POINT_CLASS, LABEL_CLASS, Instance, DiagramLock, Referrer } from 'src/app/core/models/reactome-instance.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { UnsavedUploadDialogComponent } from 'src/app/shared/components/unsaved-upload-dialog/unsaved-upload-dialog.component';
import { CommitWaitDialogComponent } from 'src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component';
import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Store } from '@ngrx/store';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { PathwayDiagramObjectActions } from './state/pathway-diagram-object.actions';
import { pathwayDiagramObjects } from './state/pathway-diagram-object.selectors';
import { PathwayDiagramObject } from './state/pathway-diagram-object.model';

interface PendingDiagramDraft {
  pathwayId: string;
  diagramLock: DiagramLock;
  network: any;
  username: string;
  savedAt: string;
}

interface StoredPathwayDiagramLockRef {
  diagramDbId: number;
  lockId?: string;
  updatedAt: string;
}

interface StoredExactSavedDiagramNetwork {
  diagramDbId: number;
  pathwayDbId: number;
  network: any;
  savedAt: string;
}

@Component({
  selector: 'app-pathway-diagram',
  standalone: true,
  imports: [DiagramComponent, CommonModule, EditorActionsComponent, MatIconModule],
  templateUrl: './pathway-diagram.component.html',
  styleUrl: './pathway-diagram.component.scss',
  providers: [PathwayDiagramUtilService]
})
export class PathwayDiagramComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly pendingDiagramDraftSessionKey = 'pendingPathwayDiagramDraft';
  private readonly pathwayDiagramLockRefsStorageKey = 'pathwayDiagramLockRefs';
  private readonly exactSavedDiagramNetworksStorageKey = 'exactSavedDiagramNetworks';
  private readonly diagramReloadDebugStorageKey = 'diagramReloadDebug';
  // Special case to navigate away from the current event
  @Output() goToPathwayEvent = new EventEmitter<number>();
  @Output() openPathwayDiagramEvent = new EventEmitter<any>();
  id$ = this.route.params.pipe(
    map(params => params['id']),
    filter(id => id !== undefined)
  )
  // pathway id for the displayed diagram
  // Note: This is not the id for the PathwayDiagram instance.
  pathwayId: string = ""; // Use empty string to make the diagram service happy
  // keep the select id in queryParam
  select: string = "";
  // PathwayDiagram id for editing
  pathwayDiagramId: string = "";
  private requestedLockDiagramId: string = "";
  private currentStagedDiagramDbId: string = '';

  @ViewChild('diagramComponent')
  diagram!: DiagramComponent;

  // Try to control the popup menu
  showMenu: boolean = false;
  menuPositionX: string = "0px";
  menuPositionY: string = "0px";
  // A little bit buffer between the mouse point and the menu position
  MENU_POSITION_BUFFER = 5;

  // The current node or edge under the mouse
  elementUnderMouse: any;
  elementTypeForPopup: ElementType = ElementType.CYTOSCAPE; // Default always
  // Tracking the editing status
  isEditing: boolean = false;
  // A flag to track if there is any editing. Anything just edited
  isEdited: boolean = false;
  // Flag is the edge under the mouse is edtiable
  // If the element under the mouse is not an edge, this flag should be false
  isEdgeEditable: boolean = false;
  // Flag for adding a flowline between a PE node and a ProcessNode (for pathway)
  isFlowLineAddable: boolean = false;
  // flag is the clicked pathway is deletable
  isPathwayDeletable: boolean = false;
  // Tracking the previous dragging position: should cytoscape provides this?
  previousDragPos: Position = { x: 0, y: 0 };
  // Track a list of nodes that are under resizing
  resizingNodes: any[] = [];
  // Tracking the last viewport for restoring after reloading
  private storedViewport: { zoom: number, pan: { x: number, y: number } } | null = null;
  private lastLoadedNetworkId: string = '';
  // To show information
  readonly dialog = inject(MatDialog);
  private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;
  private isUploadInProgress: boolean = false;
  private diagramLockInfo: DiagramLock | null = null;
  // To show the label for the diagram displayed
  diagramLabel: string = 'Pathway Diagram';
  lockStatus: 'idle' | 'acquiring' | 'acquired' | 'blocked' | 'error' = 'idle';
  lockStatusMessage: string = 'Lock not requested.';
  private isUnlockingDiagram: boolean = false;
  private diagramLoadRequestId: number = 0;

  get isDiagramLocked(): boolean {
    return this.lockStatus === 'acquired' || this.lockStatus === 'blocked';
  }

  get isLockOwnedByMe(): boolean {
    return !!this.diagramLockInfo && this.isLockOwnedByCurrentUser(this.diagramLockInfo);
  }

  get lockIndicatorTooltip(): string {
    if (this.lockStatus === 'acquired')
      return 'Locked by you.';
    if (this.lockStatus === 'blocked')
      return this.lockStatusMessage;
    return '';
  }

  constructor(private route: ActivatedRoute,
    private router: Router,
    private store: Store,
    private diagramUtils: PathwayDiagramUtilService,
    private authService: AuthenticateService,
    private instUtil: InstanceUtilities
  ) {
  }

  ngOnInit() {
    this.instUtil.resetInst$.subscribe((data) => {
      this.diagramUtils.handleInstanceReset(data, this);
    });
    this.instUtil.lastUpdatedInstance$.subscribe(data => {
      this.diagramUtils.handleInstanceEdit(data.attribute, data.instance, this);
    });
    this.store.select(pathwayDiagramObjects()).subscribe((objects: PathwayDiagramObject[]) => {
      // Handle late-arriving staged diagrams (common right after login) and
      // cross-tab updates. Skip when we don't have a pathway loaded or the
      // user is actively editing or an upload is in progress.
      if (!this.pathwayId || this.pathwayId === '0' || this.isEditing || this.isUploadInProgress)
        return;
      if (!objects || objects.length === 0)
        return;

      // If there's an active load request, reuse it, otherwise start a
      // short-lived load request so the staged object can be resolved and
      // displayed immediately. This ensures other tabs' storage events cause
      // an update even when the initial navigation load has completed.
      const loadRequestId = this.diagramLoadRequestId === 0 ? this.beginDiagramLoadRequest() : this.diagramLoadRequestId;
      this.tryLoadStagedNetworkWithObjects(objects, () => { }, false, loadRequestId);
    });
  }

  ngAfterViewInit(): void {
    this.route.params.subscribe(params => {
      console.debug('Route params before loading in pathway-dagiram: ', params);
      const queryParams = this.route.snapshot.queryParams;
      console.debug('Query params before loading in pathway-diagram: ', queryParams);
      const id = params['id'];
      // Do nothing if nothing is loaded
      if (!id || id === '0') return;
      const loadNewDiagram = () => {
        this.releaseOwnedDiagramLock();
        this.pathwayId = id;
        const stagedDiagramDbId = Number(queryParams['stagedDiagramDbId']);
        this.currentStagedDiagramDbId = Number.isFinite(stagedDiagramDbId) && stagedDiagramDbId > 0
          ? stagedDiagramDbId.toString()
          : '';
        this.diagram.diagramId = this.currentStagedDiagramDbId.length > 0
          ? this.currentStagedDiagramDbId
          : this.pathwayId;
        this.select = queryParams['select'] ?? '';
        // Always not in the editing mode when loading via URL
        this.isEditing = false;
        this.isEdited = false;
        this.pathwayDiagramId = ''; // Reset before load so referrer-based staged lookup can run.
        // Restore lock state if the user already owns a lock for this pathway (e.g. returning to a staged diagram).
        this.tryRestoreLockStateFromStoredRef();
        const loadRequestId = this.loadPathwayDiagram();
        this.restorePendingDiagramDraft(this.pathwayId, loadRequestId);
      };
      const isSwitchingDiagram = this.pathwayId.length > 0 && this.pathwayId !== id;
      if (isSwitchingDiagram) {
        this.promptUploadBeforeDiscard('loading another diagram', loadNewDiagram);
        return;
      }
      loadNewDiagram();
    });
    // Do any post processing after the network is displayed.
    // Use this method to avoid threading issue and any arbitray delay.
    this.diagram.cytoscapeContainer!.nativeElement.addEventListener('network_displayed', () => {
      this.initDiagram();
      // Need to do selection here
      this.selectObjectsInDiagram(this.select);
    })
    // The following works and may provide some flexibility. However,
    // this may bring us some headace to handle the two subscriptions
    // for both pathParams and queryParams. It may not be reliable
    // to figure out the sequence of these two subscriptions. Therefore,
    // we will handle the event click directly to synchronize selection.
    // Handle the selection when in the same diagram.
    // Ideally this should be handled inside the diagram widget.
    // Turn both on and pay attention to any side effects
    this.route.queryParams.subscribe((queryParams) => {
      const params = this.route.snapshot.params;
      if (this.pathwayId !== params['id'])
        return;

      const stagedDiagramDbId = Number(queryParams['stagedDiagramDbId']);
      const requestedStagedDiagramId = Number.isFinite(stagedDiagramDbId) && stagedDiagramDbId > 0
        ? stagedDiagramDbId.toString()
        : '';

      if (!this.isEditing && requestedStagedDiagramId.length > 0) {
        const shouldReloadStagedDiagram =
          this.diagram?.diagramId !== requestedStagedDiagramId ||
          this.currentStagedDiagramDbId !== requestedStagedDiagramId;
        if (shouldReloadStagedDiagram) {
          this.currentStagedDiagramDbId = requestedStagedDiagramId;
          this.diagram.diagramId = requestedStagedDiagramId;
          this.pathwayDiagramId = '';
          this.isEdited = false;
          this.loadPathwayDiagram();
          return;
        }
      }
      else {
        this.currentStagedDiagramDbId = '';
      }

      const currentSelected = queryParams['select'];
      this.select = currentSelected;
      this.selectObjectsInDiagram(currentSelected);
    });
  }

  ngOnDestroy(): void {
    this.releaseOwnedDiagramLock();
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.isEdited)
      return;
    event.preventDefault();
    event.returnValue = 'You have unsaved pathway diagram changes. Upload them before closing or reloading this page.';
  }

  @HostListener('document:visibilitychange')
  handleVisibilityChange() {
    if (!document.hidden)
      return;
    this.releaseOwnedDiagramLock();
  }

  private resetDiagramLockState() {
    this.diagramLockInfo = null;
    this.pathwayDiagramId = '';
    this.requestedLockDiagramId = '';
    this.lockStatus = 'idle';
    this.lockStatusMessage = 'Lock not requested.';
    this.isEditing = false;
    if (this.diagram)
      this.diagramUtils.disableEditing(this.diagram);
  }

  private releaseOwnedDiagramLock() {
    if (!this.diagramLockInfo || !this.isLockOwnedByCurrentUser(this.diagramLockInfo) || this.isUnlockingDiagram)
      return;
    if (this.isEdited)
      this.persistDiagramDraftToSessionStorage(this.diagramLockInfo);
    this.isUnlockingDiagram = true;
    const lockToRelease = this.diagramLockInfo;
    this.resetDiagramLockState();
    this.diagramUtils.getDataService().unlockDiagram(lockToRelease).pipe(take(1)).subscribe({
      next: () => {
        this.isUnlockingDiagram = false;
      },
      error: () => {
        this.isUnlockingDiagram = false;
      }
    });
  }

  private promptUploadBeforeDiscard(action: string, proceed: () => void) {
    if (!this.isEdited) {
      proceed();
      return;
    }
    this.stagePathwayDiagramObject(this.diagramLockInfo as DiagramLock);
    // const dialogRef = this.dialog.open(UnsavedUploadDialogComponent, {
    //   data: {
    //     title: 'Unsaved Changes',
    //     message: `This diagram has unsaved changes. Upload before ${action}?`
    //   },
    //   disableClose: true
    // });
    // dialogRef.afterClosed().pipe(take(1)).subscribe((shouldUpload: boolean | null) => {
    //   if (shouldUpload === true)
    //     this.uploadDiagram(false, proceed);
    //   else if (shouldUpload === false)
    //     proceed();
    // });
  }

  private storeViewport() {
    if (this.diagram.cy) {
      this.storedViewport = {
        zoom: this.diagram.cy.zoom(),
        pan: this.diagram.cy.pan()
      };
      console.debug('Stored viewport:', this.storedViewport);
    }
  }

  private loadPathwayDiagram(): number {
    const loadRequestId = this.beginDiagramLoadRequest();
    this.storeViewport();
    this.tryLoadStagedNetwork(() => this.loadPathwayDiagramFromBackend(loadRequestId), loadRequestId);
    return loadRequestId;
  }

  private beginDiagramLoadRequest(): number {
    this.diagramLoadRequestId += 1;
    return this.diagramLoadRequestId;
  }

  private isDiagramLoadRequestActive(loadRequestId: number): boolean {
    return loadRequestId === this.diagramLoadRequestId;
  }

  private tryLoadStagedNetwork(onMiss: () => void, loadRequestId: number) {
    this.store.select(pathwayDiagramObjects()).pipe(take(1)).subscribe((objects: PathwayDiagramObject[]) => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      this.tryLoadStagedNetworkWithObjects(objects ?? [], onMiss, true, loadRequestId);
    });
  }

  private tryLoadStagedNetworkWithObjects(objects: PathwayDiagramObject[], onMiss: () => void, allowBackendLookup: boolean = false, loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return;

    const currentDiagramId = parseInt(this.diagram.diagramId || '');
    this.debugDiagramReload(`Start staged reload resolution for diagramId=${this.diagram.diagramId}, parsed=${currentDiagramId}, objects=${objects.length}, allowBackendLookup=${allowBackendLookup}.`);

    // Merge any persisted staged objects from localStorage (effects persist snapshots there).
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type);
        if (raw) {
          const parsed = JSON.parse(JSON.parse(raw).object || '[]') as PathwayDiagramObject[];
          if (parsed && parsed.length > 0) {
            // Convert to map keyed by pathwayDiagramDbId so persisted staged entries can override in-memory ones.
            const mergedMap = new Map<number, PathwayDiagramObject>();
            (objects || []).forEach(o => {
              const id = Number(o?.pathwayDiagramDbId ?? o?.diagramLock?.diagramDbId);
              if (Number.isFinite(id)) mergedMap.set(id, o);
            });
            parsed.forEach(o => {
              const id = Number(o?.pathwayDiagramDbId ?? o?.diagramLock?.diagramDbId);
              if (Number.isFinite(id)) mergedMap.set(id, o);
            });
            objects = Array.from(mergedMap.values());
            this.debugDiagramReload(`Merged ${parsed.length} staged objects from localStorage; total objects=${objects.length}.`);
          }
        }
      }
      catch (e) {
        // ignore parse errors and continue
      }
    }

    // Hard fallback: use same-pathway pending draft directly from session storage.
    // This bypasses referrer/backend timing issues during rapid route navigation.
    if (!this.isEditing && !this.pathwayDiagramId && !Number.isNaN(currentDiagramId) && currentDiagramId > 0) {
      const exactSavedByPathway = this.getExactSavedNetwork(undefined, currentDiagramId);
      if (exactSavedByPathway) {
        this.debugDiagramReload(`Found exact-saved network for pathwayDbId=${currentDiagramId}.`);
        if (this.tryDisplayStagedNetwork(exactSavedByPathway, loadRequestId))
          return;
      }

      const pendingDraftNetwork = this.getPendingDraftNetworkForPathway(currentDiagramId);
      if (pendingDraftNetwork) {
        this.debugDiagramReload(`Found pending draft for pathwayDbId=${currentDiagramId}.`);
        if (this.tryDisplayStagedNetwork(pendingDraftNetwork, loadRequestId))
          return;
      }
    }

    const onStagedMiss = () => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      if (allowBackendLookup)
        this.tryLoadStagedNetworkFromBackend(objects, onMiss, loadRequestId);
      else
        onMiss();
    };

    if (!Number.isNaN(currentDiagramId)) {
      if (!this.isEditing && !this.pathwayDiagramId) {
        const savedLockDiagramDbId = this.getSavedDiagramDbIdForPathway(currentDiagramId);
        if (savedLockDiagramDbId) {
          this.debugDiagramReload(`Using saved lock mapping pathwayDbId=${currentDiagramId} -> diagramDbId=${savedLockDiagramDbId}.`);
          const exactSavedByLock = this.getExactSavedNetwork(savedLockDiagramDbId, currentDiagramId);
          if (exactSavedByLock && this.tryDisplayStagedNetwork(exactSavedByLock, loadRequestId)) {
            return;
          }
          const stagedBySavedLock = this.findStagedPathwayDiagramObject(objects, savedLockDiagramDbId);
          const stagedBySavedLockNetwork = this.extractNetworkFromStagedObject(stagedBySavedLock);
          if (stagedBySavedLockNetwork && this.tryDisplayStagedObject(stagedBySavedLock, stagedBySavedLockNetwork, loadRequestId)) {
            return;
          }
          this.debugDiagramReload(`Saved lock mapping diagramDbId=${savedLockDiagramDbId} did not yield a displayable staged network.`);
        }
        else {
          this.debugDiagramReload(`No saved lock mapping for pathwayDbId=${currentDiagramId}.`);
        }
      }

      // Non-edit mode diagramId is pathway dbId. Prefer direct pathway-keyed staged drafts first.
      if (!this.isEditing && !this.pathwayDiagramId) {
        const stagedByPathway = this.findStagedPathwayDiagramObjectByPathwayId(objects, currentDiagramId);
        const stagedPathwayNetwork = this.extractNetworkFromStagedObject(stagedByPathway);
        if (stagedPathwayNetwork && this.tryDisplayStagedObject(stagedByPathway, stagedPathwayNetwork, loadRequestId)) {
          return;
        }
        this.debugDiagramReload(`No displayable staged network found by pathwayDbId=${currentDiagramId}.`);
      }

      const staged = this.findStagedPathwayDiagramObject(objects, currentDiagramId);
      const stagedNetwork = this.extractNetworkFromStagedObject(staged);
      if (stagedNetwork && this.tryDisplayStagedObject(staged, stagedNetwork, loadRequestId)) {
        return;
      }
      this.debugDiagramReload(`No displayable staged network found by diagramDbId=${currentDiagramId}.`);
    }

    // In normal mode, diagramId is pathway/instance dbId. Resolve PathwayDiagram via referrers first.
    if (!this.isEditing && !this.pathwayDiagramId && !Number.isNaN(currentDiagramId) && currentDiagramId > 0) {
      this.debugDiagramReload(`Trying referrer-based staged resolution for pathwayDbId=${currentDiagramId}.`);
      this.tryLoadStagedNetworkViaReferrers(objects, currentDiagramId, onStagedMiss, loadRequestId);
      return;
    }

    this.debugDiagramReload('No staged match found. Proceeding to fallback handler.');
    onStagedMiss();
  }

  private tryLoadStagedNetworkFromBackend(existingObjects: PathwayDiagramObject[], onMiss: () => void, loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return;

    const userName = this.authService.getUser();
    if (!userName) {
      onMiss();
      return;
    }
    this.diagramUtils.getDataService().getPathwayDiagrams(userName).pipe(take(1)).subscribe({
      next: (backendObjects: PathwayDiagramObject[]) => {
        if (!this.isDiagramLoadRequestActive(loadRequestId))
          return;
        if (!backendObjects || backendObjects.length === 0) {
          this.debugDiagramReload('Backend staged diagram fetch returned no objects.');
          onMiss();
          return;
        }
        this.debugDiagramReload(`Backend staged diagram fetch returned ${backendObjects.length} objects.`);
        const mergedObjects = this.mergePathwayDiagramObjects(existingObjects, backendObjects);
        this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: mergedObjects }));
        this.tryLoadStagedNetworkWithObjects(mergedObjects, onMiss, false, loadRequestId);
      },
      error: () => {
        if (!this.isDiagramLoadRequestActive(loadRequestId))
          return;
        this.debugDiagramReload('Backend staged diagram fetch failed. Falling back to backend diagram/cy load.');
        onMiss();
      }
    });
  }

  private mergePathwayDiagramObjects(existingObjects: PathwayDiagramObject[], backendObjects: PathwayDiagramObject[]): PathwayDiagramObject[] {
    const mergedByDbId = new Map<number, PathwayDiagramObject>();
    const getDiagramDbId = (item: PathwayDiagramObject): number | undefined => {
      const normalizedDbId = Number(item?.pathwayDiagramDbId ?? item?.pathwayDiagramDbId ?? item?.diagramLock?.diagramDbId);
      return Number.isFinite(normalizedDbId) ? normalizedDbId : undefined;
    };

    backendObjects.forEach((item: PathwayDiagramObject) => {
      if (!item)
        return;
      const diagramDbId = getDiagramDbId(item);
      if (!diagramDbId)
        return;
      mergedByDbId.set(diagramDbId, item);
    });

    // Keep existing in-memory edits over backend snapshots for the same diagram.
    existingObjects.forEach((item: PathwayDiagramObject) => {
      if (!item)
        return;
      const diagramDbId = getDiagramDbId(item);
      if (!diagramDbId)
        return;
      mergedByDbId.set(diagramDbId, item);
    });

    return Array.from(mergedByDbId.values());
  }

  private tryLoadStagedNetworkViaReferrers(objects: PathwayDiagramObject[], pathwayDbId: number, onMiss: () => void, loadRequestId: number) {
    this.diagramUtils.getDataService().getReferrers(pathwayDbId).pipe(take(1)).subscribe({
      next: (referrers: Referrer[]) => {
        if (!this.isDiagramLoadRequestActive(loadRequestId))
          return;

        const diagramDbIds = new Set<number>();
        referrers?.forEach((referrer: Referrer) => {
          referrer.referrers?.forEach((inst: Instance) => {
            if (inst?.schemaClassName === 'PathwayDiagram' && inst.dbId)
              diagramDbIds.add(inst.dbId);
          });
        });

        for (const diagramDbId of diagramDbIds) {
          const staged = this.findStagedPathwayDiagramObject(objects, diagramDbId);
          const stagedNetwork = this.extractNetworkFromStagedObject(staged);
          if (stagedNetwork && this.tryDisplayStagedObject(staged, stagedNetwork, loadRequestId)) {
            return;
          }
        }

        this.debugDiagramReload(`Referrer lookup for pathwayDbId=${pathwayDbId} yielded diagramDbIds=[${Array.from(diagramDbIds).join(', ')}], none displayable.`);
        this.tryLoadBackendNetworkForDiagramDbIds(Array.from(diagramDbIds), onMiss, loadRequestId);
        return;

        // Fallback for cases where referrers are incomplete/unavailable.
        this.diagramUtils.getDataService().fetchPathwayDiagram(pathwayDbId).pipe(take(1)).subscribe({
          next: (pathwayDiagram: Instance) => {
            if (!this.isDiagramLoadRequestActive(loadRequestId))
              return;
            const diagramDbId = pathwayDiagram?.dbId;
            const staged = diagramDbId ? this.findStagedPathwayDiagramObject(objects, diagramDbId) : undefined;
            const stagedNetwork = this.extractNetworkFromStagedObject(staged);
            if (stagedNetwork && this.tryDisplayStagedNetwork(stagedNetwork, loadRequestId)) {
              return;
            }
            this.debugDiagramReload(`fetchPathwayDiagram fallback returned diagramDbId=${diagramDbId}, still no displayable staged network.`);
            if (diagramDbId) {
              this.tryLoadBackendNetworkForDiagramDbIds([diagramDbId], onMiss, loadRequestId);
              return;
            }
            onMiss();
          },
          error: () => {
            if (!this.isDiagramLoadRequestActive(loadRequestId))
              return;
            this.debugDiagramReload('fetchPathwayDiagram fallback failed after referrer lookup.');
            onMiss();
          }
        });
      },
      error: () => {
        if (!this.isDiagramLoadRequestActive(loadRequestId))
          return;

        // Fallback for cases where referrers endpoint fails.
        this.diagramUtils.getDataService().fetchPathwayDiagram(pathwayDbId).pipe(take(1)).subscribe({
          next: (pathwayDiagram: Instance) => {
            if (!this.isDiagramLoadRequestActive(loadRequestId))
              return;
            const diagramDbId = pathwayDiagram?.dbId;
            const staged = diagramDbId ? this.findStagedPathwayDiagramObject(objects, diagramDbId) : undefined;
            const stagedNetwork = this.extractNetworkFromStagedObject(staged);
            if (stagedNetwork && this.tryDisplayStagedNetwork(stagedNetwork, loadRequestId)) {
              return;
            }
            this.debugDiagramReload(`Referrer API failed. fetchPathwayDiagram fallback returned diagramDbId=${diagramDbId}, no displayable staged network.`);
            if (diagramDbId) {
              this.tryLoadBackendNetworkForDiagramDbIds([diagramDbId], onMiss, loadRequestId);
              return;
            }
            onMiss();
          },
          error: () => {
            if (!this.isDiagramLoadRequestActive(loadRequestId))
              return;
            this.debugDiagramReload('Referrer API failed and fetchPathwayDiagram fallback failed.');
            onMiss();
          }
        });
      }
    });
  }

  private loadPathwayDiagramFromBackend(loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return;

    // Always prefer the edited staged copy when available.
    this.store.select(pathwayDiagramObjects()).pipe(take(1)).subscribe((objects: PathwayDiagramObject[]) => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      this.tryLoadStagedNetworkWithObjects(objects ?? [], () => this.loadPathwayDiagramFromBackendInternal(loadRequestId), false, loadRequestId);
    });
  }

  private loadPathwayDiagramFromBackendInternal(loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return;

    const requestedDiagramId = this.diagram.diagramId;

    // Check if we have cytoscape network. If yes, load it.
    this.diagramUtils.getDataService().hasCytoscapeNetwork(requestedDiagramId).subscribe((hasCyNetwork: boolean) => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      this.diagramUtils.clearSelection(this.diagram);
      if (hasCyNetwork) {
        this.diagramUtils.getDataService().getCytoscapeNetwork(requestedDiagramId).subscribe((cytoscapeJson: any) => {
          if (!this.isDiagramLoadRequestActive(loadRequestId))
            return;
          this.diagram.displayNetwork(cytoscapeJson.elements);
          try { this.applyNetworkMetadata(cytoscapeJson); this.diagram.updateLegend?.(); this.normalizeLegendPosition(); } catch (e) { }
          this.setDiagramLabel(loadRequestId);
        });
      }
      else {
        // When pathway-level cytoscape is absent, try its PathwayDiagram cytoscape network first.
        this.diagramUtils.getDataService().fetchPathwayDiagram(requestedDiagramId).pipe(take(1)).subscribe({
          next: (pathwayDiagram: Instance) => {
            if (!this.isDiagramLoadRequestActive(loadRequestId))
              return;

            const pathwayDiagramDbId = Number(pathwayDiagram?.dbId);
            if (Number.isFinite(pathwayDiagramDbId) && pathwayDiagramDbId > 0) {
              this.diagramUtils.getDataService().hasCytoscapeNetwork(pathwayDiagramDbId).pipe(take(1)).subscribe({
                next: (hasDiagramCyNetwork: boolean) => {
                  if (!this.isDiagramLoadRequestActive(loadRequestId))
                    return;
                  if (hasDiagramCyNetwork) {
                    this.diagramUtils.getDataService().getCytoscapeNetwork(pathwayDiagramDbId).pipe(take(1)).subscribe({
                      next: (cytoscapeJson: any) => {
                        if (!this.isDiagramLoadRequestActive(loadRequestId))
                          return;
                        this.diagram.displayNetwork(cytoscapeJson.elements);
                        try { this.applyNetworkMetadata(cytoscapeJson); this.diagram.updateLegend?.(); this.normalizeLegendPosition(); } catch (e) { }
                        this.setDiagramLabel(loadRequestId);
                      },
                      error: () => this.loadStaticDiagramOrEmpty(requestedDiagramId, loadRequestId)
                    });
                    return;
                  }
                  this.loadStaticDiagramOrEmpty(requestedDiagramId, loadRequestId);
                },
                error: () => this.loadStaticDiagramOrEmpty(requestedDiagramId, loadRequestId)
              });
              return;
            }

            this.loadStaticDiagramOrEmpty(requestedDiagramId, loadRequestId);
          },
          error: () => this.loadStaticDiagramOrEmpty(requestedDiagramId, loadRequestId)
        });
      }
    });
  }

  private loadStaticDiagramOrEmpty(requestedDiagramId: string, loadRequestId: number) {
    this.diagramUtils.getDataService().hasDiagram(requestedDiagramId).pipe(take(1)).subscribe((hasDiagramJson: boolean) => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      if (hasDiagramJson) {
        try {
          this.diagram.loadDiagram();
          this.setDiagramLabel(loadRequestId);
        } catch (error) {
          console.error('Error loading diagram:', error);
          this.dialog.open(InfoDialogComponent, {
            data: {
              title: 'Error',
              message: 'Failed to load diagram. The diagram may not exist or is invalid.'
            }
          });
        }
      }
      else {
        this.createEmptyDiagram(parseInt(requestedDiagramId));
        this.setDiagramLabel(loadRequestId);
      }
    });
  }

  private findStagedPathwayDiagramObject(objects: PathwayDiagramObject[], diagramDbId: number): PathwayDiagramObject | undefined {
    const requestedDiagramDbId = Number(diagramDbId);
    return objects.find(item =>
      Number(item.pathwayDiagramDbId ?? item.pathwayDiagramDbId ?? item.diagramLock?.diagramDbId) === requestedDiagramDbId
    );
  }

  private findStagedPathwayDiagramObjectByPathwayId(objects: PathwayDiagramObject[], pathwayDbId: number): PathwayDiagramObject | undefined {
    const requestedPathwayDbId = Number(pathwayDbId);
    return objects.find(item => Number(item.pathwayDbId) === requestedPathwayDbId);
  }

  private extractNetworkFromStagedObject(staged?: PathwayDiagramObject): any | undefined {
    if (!staged)
      return undefined;
    const normalizeNetwork = (candidate: any): any | undefined => {
      let value = candidate;
      // Handle one or more levels of string-encoded JSON payloads.
      for (let i = 0; i < 3 && typeof value === 'string'; i++) {
        try {
          value = JSON.parse(value);
        }
        catch {
          break;
        }
      }
      if (!value)
        return undefined;
      if (value.elements)
        return value;
      if (value.network?.elements)
        return value.network;
      if (value.nodes || value.edges)
        return { elements: { nodes: value.nodes ?? [], edges: value.edges ?? [] } };
      if (value.network && (value.network.nodes || value.network.edges))
        return { elements: { nodes: value.network.nodes ?? [], edges: value.network.edges ?? [] } };
      return undefined;
    };

    return normalizeNetwork(staged.network) ?? normalizeNetwork(staged as any);
  }

  private tryDisplayStagedNetwork(network: any, loadRequestId: number): boolean {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return false;
    if (!network?.elements)
      return false;
    try {
      this.diagramUtils.clearSelection(this.diagram);
      this.diagram.displayNetwork(network.elements);
      try { this.applyNetworkMetadata(network); this.diagram.updateLegend?.(); this.normalizeLegendPosition(); } catch (e) { }
      this.setDiagramLabel(loadRequestId);
      this.debugDiagramReload(`Displayed staged network with nodes=${network.elements?.nodes?.length ?? 0}, edges=${network.elements?.edges?.length ?? 0}.`);
      return true;
    }
    catch (error) {
      console.warn('Failed to display staged pathway diagram network. Falling back to backend load.', error);
      this.debugDiagramReload('Failed to display staged network due to rendering error.');
      return false;
    }
  }

  private tryDisplayStagedObject(staged: PathwayDiagramObject | undefined, network: any, loadRequestId: number): boolean {
    if (!staged)
      return this.tryDisplayStagedNetwork(network, loadRequestId);
    const displayed = this.tryDisplayStagedNetwork(network, loadRequestId);
    if (!displayed)
      return false;

    // Restore lock info from the staged object and enable editing when owned by current user.
    try {
      if (staged.diagramLock) {
        this.diagramLockInfo = staged.diagramLock;
        this.updateLockStatus(this.diagramLockInfo);
        if (this.isLockOwnedByCurrentUser(this.diagramLockInfo)) {
          this.isEditing = true;
          this.diagramUtils.enableEditing(this.diagram);
        }
      }
    }
    catch (e) {
      console.warn('Failed to restore staged diagram lock/edit state.', e);
    }

    return true;
  }

  private tryLoadBackendNetworkForDiagramDbIds(diagramDbIds: number[], onMiss: () => void, loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId))
      return;

    const uniqueDbIds = Array.from(new Set((diagramDbIds || [])
      .map((id: number) => Number(id))
      .filter((id: number) => Number.isFinite(id) && id > 0)));

    if (uniqueDbIds.length === 0) {
      onMiss();
      return;
    }

    const tryByIndex = (index: number) => {
      if (!this.isDiagramLoadRequestActive(loadRequestId))
        return;
      if (index >= uniqueDbIds.length) {
        this.debugDiagramReload(`No backend cytoscape network available for diagramDbIds=[${uniqueDbIds.join(', ')}].`);
        onMiss();
        return;
      }

      const diagramDbId = uniqueDbIds[index];
      this.diagramUtils.getDataService().hasCytoscapeNetwork(diagramDbId).pipe(take(1)).subscribe({
        next: (hasCyNetwork: boolean) => {
          if (!this.isDiagramLoadRequestActive(loadRequestId))
            return;
          if (!hasCyNetwork) {
            this.debugDiagramReload(`No backend cytoscape network found for diagramDbId=${diagramDbId}.`);
            tryByIndex(index + 1);
            return;
          }

          this.diagramUtils.getDataService().getCytoscapeNetwork(diagramDbId).pipe(take(1)).subscribe({
            next: (cytoscapeJson: any) => {
              if (!this.isDiagramLoadRequestActive(loadRequestId))
                return;
              const network = cytoscapeJson?.elements
                ? cytoscapeJson
                : (cytoscapeJson?.network?.elements ? cytoscapeJson.network : undefined);
              if (!network?.elements) {
                this.debugDiagramReload(`Backend cytoscape payload for diagramDbId=${diagramDbId} had no elements.`);
                tryByIndex(index + 1);
                return;
              }
              this.diagramUtils.clearSelection(this.diagram);
              this.diagram.displayNetwork(network.elements);
              try { this.applyNetworkMetadata(network); this.diagram.updateLegend?.(); this.normalizeLegendPosition(); } catch (e) { }
              this.setDiagramLabel(loadRequestId);
              this.debugDiagramReload(`Displayed backend cytoscape network by diagramDbId=${diagramDbId}.`);
            },
            error: () => {
              if (!this.isDiagramLoadRequestActive(loadRequestId))
                return;
              this.debugDiagramReload(`Failed to fetch backend cytoscape network for diagramDbId=${diagramDbId}.`);
              tryByIndex(index + 1);
            }
          });
        },
        error: () => {
          if (!this.isDiagramLoadRequestActive(loadRequestId))
            return;
          this.debugDiagramReload(`Failed to check backend cytoscape network availability for diagramDbId=${diagramDbId}.`);
          tryByIndex(index + 1);
        }
      });
    };

    tryByIndex(0);
  }

  private setDiagramLabel(loadRequestId?: number) {
    const requestedDiagramId = parseInt(this.diagram.diagramId);
    this.diagramUtils.getDataService().fetchInstance(requestedDiagramId).subscribe((instance: Instance) => {
      if (loadRequestId !== undefined && !this.isDiagramLoadRequestActive(loadRequestId))
        return;
      if (instance) {
        this.diagramLabel = `${instance.schemaClassName}: ${instance.displayName}` || 'Pathway Diagram';
      }
    });
  }

  /**
   * When a diagram is switched to the editing mode, its PathwayDiagram JSON diagram will be used for editing.
   * If the diagram is not shared (i.e. there is only one representedPathway in the PathwayDiagram instance), the PathwayDiagram
   * and Pathway itself should have the same JSON text. Using either JSON text should be fine. As the matter of the fact, the 
   * backend uses symbolic link to point to the same JSON text for both instances. However, if the diagram is shared by multiple pathways 
   * (one normal and other disease Pathways), the PathwayDiagram JSON text may be different from the Pathway JSON text. Disabling editing
   * will still use the editing JSON text, which is PathwayDiagram, for display to keep the users at the same view. The user has to 
   * upload the edited pathway diagram to the JSON text for the Pathway instance, which is post-processed at the server side for 
   * overlaying etc.
   */
  private disableEditing() {
    this.diagramUtils.disableEditing(this.diagram);
    this.resizingNodes.forEach(node => this.diagramUtils.disableResizeCompartment(node, this.diagram));
    this.resizingNodes.length = 0;
    this.isEditing = false;

    if (this.diagramLockInfo && this.isLockOwnedByCurrentUser(this.diagramLockInfo)) {
      if (this.isEdited)
        this.persistDiagramDraftToSessionStorage(this.diagramLockInfo);
      this.lockStatus = 'acquired';
      this.lockStatusMessage = 'Lock retained. Editing is disabled; enable editing to continue or unlock to discard edits.';
      return;
    }

    this.lockStatus = 'idle';
    this.lockStatusMessage = 'Lock not requested.';
  }

  private canEdit(): Observable<boolean> {
    return combineLatest([
      this.store.select(newInstances()).pipe(take(1)),
      this.store.select(updatedInstances()).pipe(take(1)),
      this.store.select(deleteInstances()).pipe(take(1))
    ]).pipe(
      map(([newInsts, updatedInsts, deletedInsts]) => {
        const pendingInstances = [...newInsts, ...updatedInsts, ...deletedInsts];
        const hasBlockingInstances = pendingInstances.some(inst => this.isBlockingClassForPathwayDiagramEdit(inst));
        if (hasBlockingInstances) {
          this.dialog.open(InfoDialogComponent, {
            data: {
              title: 'Information',
              message: 'Commit staged Event, PhysicalEntity, Regulation, CatalystActivity, and PathwayDiagram before editing a pathway diagram.'
            }
          });
          return false;
        }
        return true;
      })
    );
  }

  private isBlockingClassForPathwayDiagramEdit(instance: Instance): boolean {
    const dataService = this.diagramUtils.getDataService();
    const schemaClassName = instance.schemaClassName;
    if (dataService.isEventClass(schemaClassName) ||
      dataService.isPhysicalEntityClass(schemaClassName) ||
      dataService.isRegulationClass(schemaClassName))
      return true;
    if (schemaClassName === 'PathwayDiagram' || schemaClassName === 'CatalystActivity')
      return true;
    return false;
  }

  private isLockOwnedByCurrentUser(lockInfo: DiagramLock): boolean {
    if (!lockInfo)
      return false;
    const lockUser = (lockInfo.username || '').trim().toLowerCase();
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();

    // Exact username match should always grant ownership.
    if (lockUser.length > 0 && currentUser.length > 0 && lockUser === currentUser)
      return true;
    return false;
  }


  private showDiagramLockedDialog(lockInfo: DiagramLock) {
    const owner = lockInfo.username && lockInfo.username.length > 0 ? lockInfo.username : 'another user';
    const lockedAtLine = lockInfo.lockedAt && lockInfo.lockedAt.length > 0
      ? `Locked at: ${lockInfo.lockedAt}`
      : 'Locked at: unavailable';
    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Diagram Locked',
        message: `This pathway diagram is currently locked by user "${owner}".
${lockedAtLine}
Opening diagram in read-only mode.`
      }
    });
  }

  private updateLockStatus(lockInfo: DiagramLock) {
    if (this.isLockOwnedByCurrentUser(lockInfo)) {
      this.lockStatus = 'acquired';
      this.lockStatusMessage = 'Lock acquired. Editing is available.';
      return;
    }
    if (lockInfo && lockInfo.locked) {
      const owner = lockInfo.username && lockInfo.username.length > 0 ? lockInfo.username : 'another user';
      this.lockStatus = 'blocked';
      this.lockStatusMessage = `Locked by ${owner}.`;
      return;
    }
    this.lockStatus = 'error';
    this.lockStatusMessage = 'Unable to acquire lock.';
  }

  private lockPathwayDiagram(pathwayDiagram: Instance) {
    const id = pathwayDiagram.dbId;
    if (id === undefined)
      return;
    // this.lockStatus = 'acquiring';
    // this.lockStatusMessage = 'Acquiring lock...';
    this.diagramUtils.getDataService().lockDiagram(pathwayDiagram).subscribe({
      next: (diagramLockInfo) => {
        console.debug('Diagram lock info: ', diagramLockInfo);
        if (this.isLockOwnedByCurrentUser(diagramLockInfo)) {
          this.diagramLockInfo = diagramLockInfo;
          this.pathwayDiagramId = diagramLockInfo.diagramDbId.toString();
          this.savePathwayDiagramLockRef(diagramLockInfo, this.pathwayId);
          this.isEditing = true;
          this.loadEditingDiagramOrReuseCurrent(this.pathwayDiagramId);
          this.updateLockStatus(diagramLockInfo);
          return;
        }
        this.showDiagramLockedDialog(diagramLockInfo);
      },
      error: () => {
        this.lockStatus = 'error';
        this.lockStatusMessage = 'Unable to acquire lock.';
      }
    });
  }

  private loadEditingDiagramOrReuseCurrent(pathwayDiagramId: string) {
    // Reuse the currently displayed network so users can continue editing
    // exactly what they are viewing instead of reloading a backend variant.
    if (this.hasDisplayedNetwork() || this.isEdited) {
      this.debugDiagramReload(`Reusing currently displayed network while entering edit mode for diagramDbId=${pathwayDiagramId}.`);
      this.diagramUtils.enableEditing(this.diagram);
      return;
    }

    // Always prefer staged/persisted draft network first, then backend fallback.
    this.diagram.diagramId = pathwayDiagramId;
    this.loadPathwayDiagram();
  }

  private hasDisplayedNetwork(): boolean {
    if (!this.diagram?.cy)
      return false;
    return this.diagram.cy.elements().length > 0;
  }

  private enableEditing() {
    if (this.isEditing)
      return;

    this.canEdit().subscribe((canEdit: boolean) => {
      if (!canEdit)
        return;

      // Always verify lock with the backend to enforce mutual exclusion.
      // Do not skip the backend call even if diagramLockInfo appears to be set.
      this.diagramUtils.getDataService().fetchPathwayDiagram(this.pathwayId).subscribe(pathwayDiagram => {
        if (pathwayDiagram) {
          this.lockPathwayDiagram(pathwayDiagram);
        }
        else {
          this.showNoPathwayDiagramDialog();
        }
      });
    });
  }

  private showNoPathwayDiagramDialog() {
    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Information',
        message: 'No PathwayDiagram instance was found. Create a PathwayDiagram first and commit it before editing.',
        instanceInfo: `Pathway dbId: ${this.pathwayId}`
      }
    });
  }

  /**
   * Select objects in cytoscape.js based on the passed dbId.
   * Note: dbId may be a list of ids separated by ','.
   * @param dbId
   */
  selectObjectsInDiagram(dbId: any) {
    if (dbId) {
      const id = parseInt(dbId);
      if (this.diagramUtils.isDbIdSelected(this.diagram, id))
        return;
      this.diagramUtils.select(this.diagram, dbId);
    }
    else {
      this.diagramUtils.clearSelection(this.diagram);
    }
  }

  /**
   * Create an empty diagram for editing.
   * @param pathwayId
   */
  createEmptyDiagram(pathwayId: number) {
    this.pathwayId = pathwayId.toString();
    this.diagram.diagramId = this.pathwayId;
    this.select = '';

    // this.diagram.resetState(); 
    this.diagramUtils.clearSelection(this.diagram);
    // Show nothing for this diagram
    this.diagram.displayNetwork([]);
    try { this.applyNetworkMetadata({ metadata: { zoom: 1, pan: { x: 0, y: 0 } } }); this.diagram.updateLegend?.(); this.normalizeLegendPosition(); } catch (e) { }
  }

  private initDiagram() {
    // Do nothing if nothing is loaded
    if (!this.pathwayId || this.pathwayId.length == 0)
      return;
    this.diagramUtils.diagramService = this.diagram.getDiagramService();
    this.normalizeCompartmentZIndex();
    // When the diagram is loaded first, disable node dragging to avoid
    // change the coordinates
    this.diagram.cy.nodes().grabify().panify();

    // Force it to use the light mode
    this.diagram.dark.isDark = false;

    // Have to add the following to zoom using mouse scroll.
    this.diagram.cy.zoomingEnabled(true);
    this.diagram.cy.userZoomingEnabled(true);
    this.diagram.cy.panningEnabled(true);
    this.diagram.cy.userPanningEnabled(true);

    // Add the popup trigger to the whole cytoscape and let
    // showCyPopup to figure out what menus should be shown.
    this.diagram.cy.on('cxttapstart', (e: any) => {
      this.showCyPopup(e);
    });
    this.diagram.cy.on('mousedown', (e: any) => {
      // Make sure isNode is defined as a function to avoid an error
      if (e.target !== undefined && typeof e.target.isNode === 'function') {
        if (e.target.hasClass('Modification') && !e.target.hasClass('resizing')) {
          return;
        }
        // Since we cannot get the mouse position during dragging
        // we use the target's position for the relative changes.
        const pos = e.target.position();
        this.previousDragPos.x = pos.x;
        this.previousDragPos.y = pos.y;
      }
      if (this.showMenu) {
        this.showMenu = false;
        e.preventDefault();
      }
    });
    this.diagram.cy.on('mouseup', (e: any) => {
      // reset previous drag position
      this.previousDragPos.x = 0;
      this.previousDragPos.y = 0;
      if (this.isEditing && this.diagramLockInfo && this.isEdited) {
        this.persistDiagramDraftToSessionStorage(this.diagramLockInfo);
      }
    });
    // Resize the compartment for resizing nodes
    this.diagram.cy.on('drag', 'node', (e: any) => {
      this.isEdited = true;
      let node = e.target;
      // If a node that had resize enabled is being moved, disable its resize mode
      if (node.hasClass('Compartment') && !node.hasClass(LABEL_CLASS)) {
        this.diagramUtils.disableResizeCompartment(node, this.diagram);
        let idx = this.resizingNodes.indexOf(node);
        if (idx >= 0) this.resizingNodes.splice(idx, 1);
        // Also need to make sure its sibling has no resizing
        // Check sibling
        let { isInner, other } = this.diagramUtils.getSiblingCompartment(node, this.diagram.cy);
        if (other) {
          this.diagramUtils.disableResizeCompartment(other, this.diagram);
          idx = this.resizingNodes.indexOf(node);
          if (idx >= 0) this.resizingNodes.splice(idx, 1);
        }
      }
      else if (this.resizingNodes.includes(node)) {
        this.diagramUtils.disableResizeCompartment(node, this.diagram);
        let idx = this.resizingNodes.indexOf(node);
        if (idx >= 0) this.resizingNodes.splice(idx, 1);
      }

      if (node.hasClass('Modification') && !e.target.hasClass('resizing'))
        return; // Modification nodes are handled in moveModifications. No need to handle here.
      if (node.hasClass('resizing')) {
        // This may be used for both compartment and PE node
        this.diagramUtils.resizeCompartment(node, e, this.previousDragPos);
      }
      else if (node.hasClass('Compartment') && !node.hasClass(LABEL_CLASS)) {
        // Handle compartment dragging - move both inner and outer layers together
        this.diagramUtils.moveCompartmentLayers(node, e, this.previousDragPos);
      }
      else if (node.hasClass('Protein') || node.hasClass('RNA') || node.hasClass('Gene')) {
        // Handle Modification move only for the above three types of nodes.
        this.diagramUtils.moveModifications(node, e, this.previousDragPos);
      }
      // Always update previousDragPos to track the current position
      const pos = node.position();
      this.previousDragPos.x = pos.x;
      this.previousDragPos.y = pos.y;
    });
    // Reset for anything for editing
    this.diagramUtils.id2hyperEdge.clear();
    if (this.isEditing) {
      this.diagramUtils.enableEditing(this.diagram);
    }
    this.restoreViewport();
  }

  private normalizeCompartmentZIndex() {
    if (!this.diagram?.cy)
      return;
    const compartments = this.diagram.cy.nodes('.Compartment');
    compartments.forEach((node: any) => {
      if (node.hasClass('inner'))
        node.style('z-index', 10);
      else if (node.hasClass('outer'))
        node.style('z-index', 0);
    });
  }

  private normalizeLegendPosition() {
    try {
      const cyt = (this.diagram as any)?.cytoscapeContainer?.nativeElement as HTMLElement | undefined;
      if (!cyt) return;
      const host = cyt.parentElement ?? cyt.closest('.variables');
      const legendContainer = host?.querySelector('#legend-container') as HTMLElement | null;
      if (!legendContainer) return;
      // Reset any drag-induced inline positioning so the legend returns to boundary.
      legendContainer.style.left = '';
      legendContainer.style.right = '0px';
      legendContainer.style.transform = 'none';
      legendContainer.style.transition = 'none';
    }
    catch (e) {
      // ignore
    }
  }

  private restoreViewport() {
    if (this.storedViewport && this.diagram.cy && this.pathwayId === this.lastLoadedNetworkId) {
      this.diagram.cy.viewport({
        zoom: this.storedViewport.zoom,
        pan: this.storedViewport.pan
      });
      console.debug('Restored viewport:', this.storedViewport);
    }
    this.lastLoadedNetworkId = this.pathwayId;
  }

  private showCyPopup(event: any) { // Use any to avoid any compiling error
    this.elementUnderMouse = event.target;

    // Check for multiple selected nodes with reactomeId in editing mode first
    if (this.isEditing && this.diagram?.cy) {
      const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
        // Use the following to check if it is a reaction node or PE node
        return this.isNodeForAlignment(node);
      });
      if (selectedNodes.length > 1) {
        this.elementTypeForPopup = ElementType.MULTIPLE_NODES;
        // The offset set 5px is important to prevent the native popup menu appear
        this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
        this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
        this.showMenu = true;
        return;
      }
    }

    if (this.elementUnderMouse === undefined ||
      this.elementUnderMouse === this.diagram!.cy) { // Should check for instanceof. But not sure how!
      this.elementTypeForPopup = ElementType.CYTOSCAPE; // As the default
    }
    else if (this.elementUnderMouse.isEdge()) {
      if (this.elementUnderMouse.data('edgeType') === 'FlowLine')
        this.elementTypeForPopup = ElementType.FLOWLINE;
      else
        this.elementTypeForPopup = ElementType.EDGE;
    }
    else if (this.elementUnderMouse.isNode()) {
      if (this.elementUnderMouse.hasClass("Compartment"))
        this.elementTypeForPopup = ElementType.COMPARTMENT;
      else if (this.elementUnderMouse.hasClass('PhysicalEntity')) {
        this.elementTypeForPopup = ElementType.PE_Node;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
      }
      else if (this.elementUnderMouse.hasClass("SUB")) { // This is for pathway
        this.elementTypeForPopup = ElementType.PATHWAY_NODE;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
        this.isPathwayDeletable = this.diagramUtils.isPathwayDeletable(this.elementUnderMouse);
      }
      else if (this.elementUnderMouse.hasClass(EDGE_POINT_CLASS))
        this.elementTypeForPopup = ElementType.EDGE_POINT;
      else {
        this.elementTypeForPopup = ElementType.NODE;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
      }
    }
    else
      this.elementTypeForPopup = ElementType.CYTOSCAPE;
    this.isEdgeEditable = this.diagramUtils.isEdgeEditable(this.elementUnderMouse);
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
    this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
    this.showMenu = true;
  }

  isNodeResizing() {
    if (!this.elementUnderMouse)
      return false;
    return this.resizingNodes.includes(this.elementUnderMouse);
  }

  isNodeResizable() {
    if (!this.elementUnderMouse)
      return false;
    const elmType = this.elementTypeForPopup;
    // A compartment label is compartment for deletion. But it should not be resized.
    if ((elmType == ElementType.COMPARTMENT && !this.elementUnderMouse.hasClass(LABEL_CLASS)) ||
      elmType === ElementType.PE_Node ||
      elmType === ElementType.PATHWAY_NODE)
      return true;
    return false;
  }

  onAction(action: string) {
    console.debug('Action fired: ' + action);

    switch (action) {
      case 'enableEditing':
        this.enableEditing();
        break;

      case 'disableEditing':
        this.disableEditing();
        break;

      case 'disableEdgeEditing':
        const hyperEdgeId = this.diagramUtils.getHyperEdgeId(this.elementUnderMouse);
        this.diagramUtils.disableReactionEditing(hyperEdgeId, this.diagram);
        break;

      case 'enableEdgeEditing':
        // Cannot name it as hyperEdgeId since it is in the same block as the previous one
        const hyperEdgeId1 = this.diagramUtils.getHyperEdgeId(this.elementUnderMouse);
        this.diagramUtils.enableReactionEditing(hyperEdgeId1, this.diagram);
        break;

      case 'addPoint':
        const mousePosition: Position = {
          x: parseInt(this.menuPositionX) - this.MENU_POSITION_BUFFER,
          y: parseInt(this.menuPositionY) - this.MENU_POSITION_BUFFER
        };
        this.diagramUtils.addPoint(mousePosition, this.elementUnderMouse);
        this.markDiagramEdited();
        break;

      case 'removePoint':
        this.diagramUtils.removePoint(this.elementUnderMouse);
        this.markDiagramEdited();
        break;

      case 'delete':
        this.diagramUtils.deleteHyperEdge(this.elementUnderMouse);
        this.markDiagramEdited();
        break;

      case 'resizeCompartment':
        this.diagramUtils.enableResizeCompartment(this.elementUnderMouse, this.diagram);
        this.resizingNodes.push(this.elementUnderMouse);
        break;

      case 'disableResize':
        this.disableResize();
        break;

      case 'toggleDarkMode':
        this.diagram.dark.isDark = !this.diagram.dark.isDark;
        break;

      case 'addFlowLine':
        this.diagramUtils.addFlowLine(this.elementUnderMouse, this);
        this.markDiagramEdited();
        break;

      case 'goToPathway':
        const reactomeId = this.elementUnderMouse?.data('reactomeId');
        if (reactomeId) {
          this.promptUploadBeforeDiscard('loading another diagram', () => {
            // this.router.navigate(['/event_view/instance/' + reactomeId]);
            // We will let the event tree to handle the router etc to show the diagram
            this.goToPathwayEvent.emit(reactomeId);
          });
        }
        break;

      case 'deletePathway':
        if (this.resizingNodes.includes(this.elementUnderMouse)) {
          this.disableResize();
        }
        this.diagramUtils.deletePathwayNode(this.elementUnderMouse, this.diagram);
        this.markDiagramEdited();
        break;

      case 'deleteCompartment':
        if (this.resizingNodes.includes(this.elementUnderMouse)) {
          this.disableResize();
        }
        this.diagramUtils.deleteCompartment(this.elementUnderMouse, this.diagram);
        this.markDiagramEdited();
        break;

      case 'insertCompartment':
        this.diagramUtils.insertCompartment(this.diagram);
        this.markDiagramEdited();
        break;

      case 'upload':
        this.uploadDiagram();
        break;

      case 'saveDiagramEdits':
        this.saveDiagramEdits();
        break;

      case 'reload':
        this.promptUploadBeforeDiscard('reloading this diagram', () => {
          this.diagram.diagramId = this.pathwayId
          // Disable editing first
          this.isEditing = false;
          this.isEdited = false;
          this.loadPathwayDiagram();
        });
        break;

      case 'editPathwayDiagram':
        this.diagramUtils.getDataService().fetchPathwayDiagram(this.pathwayId).subscribe({
          next: (pathwayDiagram: Instance) => {
            if (pathwayDiagram) {
              this.openPathwayDiagramEvent.emit(pathwayDiagram.dbId);
            }
            else {
              // Create a new PathwayDiagram instance when none exists
              this.createAndOpenNewPathwayDiagram();
            }
          },
          error: (error: Error) => {
            // Create a new PathwayDiagram instance on fetch error
            this.createAndOpenNewPathwayDiagram();
          }
        });
        break;

      case 'alignCentersVertically':
        this.alignNodesVertically();
        this.markDiagramEdited();
        break;

      case 'alignCentersHorizontally':
        this.alignNodesHorizontally();
        this.markDiagramEdited();
        break;

      case 'unlockDiagram':
        this.unlockDiagramWithDiscardConfirmation();
        break;

      default:
        console.debug('Unknown action: ' + action);
        break;
    }

    // Hide the menu after the action is processed
    this.showMenu = false;
  }

  private saveDiagramEdits() {
    const networkJson = this.generateNetworkJson();

    // Determine the pathwayDiagram db id to stage. Prefer explicit pathwayDiagramId stored
    // on the component, then diagram component id. If not available, abort.
    const diagramDbId = Number(this.diagramLockInfo?.diagramDbId ?? this.pathwayDiagramId ?? this.diagram?.diagramId);
    if (!Number.isFinite(diagramDbId) || diagramDbId <= 0) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'Cannot determine PathwayDiagram dbId to stage. Create or open a PathwayDiagram first.'
        }
      });
      return;
    }

    // Keep edits in local staged store; backend sync is performed periodically (2 minutes)
    // and during logout by UserInstancesService.
    this.saveExactSavedNetwork(diagramDbId, networkJson, this.pathwayId);
    this.stagePathwayDiagramObject({ diagramDbId } as DiagramLock);
    this.isEdited = false;
    this.clearDiagramDraftFromSessionStorage();

    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Information',
        message: 'Diagram edits have been staged locally. They will be persisted every 2 minutes or on logout.'
      }
    });
  }

  private unlockDiagramWithDiscardConfirmation() {
    if (this.isUnlockingDiagram)
      return;

    const shouldUnlock = window.confirm(
      'Are you sure you want to unlock this diagram? You will lose all unsaved edits and return to the original database diagram.'
    );
    if (!shouldUnlock)
      return;

    this.unlockDiagramAndDiscardEdits();
  }

  private unlockDiagramAndDiscardEdits() {
    const lockToRelease = this.diagramLockInfo && this.isLockOwnedByCurrentUser(this.diagramLockInfo)
      ? this.diagramLockInfo
      : null;
    const diagramDbId = Number(lockToRelease?.diagramDbId);
    const pathwayDbId = Number(this.pathwayId);

    this.clearAssociatedDiagramEdits(
      Number.isFinite(diagramDbId) && diagramDbId > 0 ? diagramDbId : undefined,
      Number.isFinite(pathwayDbId) && pathwayDbId > 0 ? pathwayDbId : undefined
    );
    this.isEdited = false;
    this.resetDiagramLockState();

    this.diagram.diagramId = this.pathwayId;
    const reloadOriginalDiagram = () => {
      const loadRequestId = this.beginDiagramLoadRequest();
      this.storeViewport();
      this.loadPathwayDiagramFromBackend(loadRequestId);
    };

    if (!lockToRelease) {
      reloadOriginalDiagram();
      return;
    }

    this.isUnlockingDiagram = true;
    this.diagramUtils.getDataService().unlockDiagram(lockToRelease).pipe(take(1)).subscribe({
      next: () => {
        this.diagramUtils.getDataService().deletePersistedPathwayDiagram(lockToRelease).pipe(take(1)).subscribe({
          next: () => {
            this.isUnlockingDiagram = false;
            reloadOriginalDiagram();
          },
          error: () => {
            this.isUnlockingDiagram = false;
            reloadOriginalDiagram();
          }
        });
      },
      error: () => {
        this.isUnlockingDiagram = false;
        reloadOriginalDiagram();
      }
    });
  }

  private clearAssociatedDiagramEdits(diagramDbId?: number, pathwayDbId?: number) {
    this.clearDiagramDraftFromSessionStorage();
    this.removePathwayDiagramFromStagedStore(diagramDbId, pathwayDbId);

    this.removeSavedDiagramDbIdForPathway(pathwayDbId);
    this.removeExactSavedNetwork(diagramDbId, pathwayDbId);
  }

  private removePathwayDiagramFromStagedStore(diagramDbId?: number, pathwayDbId?: number) {
    const normalizedDiagramDbId = Number(diagramDbId);
    const normalizedPathwayDbId = Number(pathwayDbId);
    const hasDiagramDbId = Number.isFinite(normalizedDiagramDbId) && normalizedDiagramDbId > 0;
    const hasPathwayDbId = Number.isFinite(normalizedPathwayDbId) && normalizedPathwayDbId > 0;

    if (!hasDiagramDbId && !hasPathwayDbId)
      return;

    // this.store.select(pathwayDiagramObjects()).pipe(take(1)).subscribe((objects: PathwayDiagramObject[]) => {
    //   const stagedObjects = objects || [];
    //   const matchingObjects = stagedObjects.filter((item: PathwayDiagramObject) => {
    //     const itemDiagramDbId = Number(item.pathwayDiagramDbId ?? item.dbId ?? item.diagramLock?.diagramDbId);
    //     const itemPathwayDbId = Number(item.pathwayDbId);
    //     const matchesDiagramDbId = hasDiagramDbId && itemDiagramDbId === normalizedDiagramDbId;
    //     const matchesPathwayDbId = hasPathwayDbId && itemPathwayDbId === normalizedPathwayDbId;
    //     return matchesDiagramDbId || matchesPathwayDbId;
    //   });

    //   if (matchingObjects.length === 0)
    //     return;

    //   // const matchedDbIds = new Set(matchingObjects.map((item: PathwayDiagramObject) => Number(item.dbId)));
    //   // const remainingObjects = stagedObjects.filter((item: PathwayDiagramObject) => !matchedDbIds.has(Number(item.dbId)));
    //   // this.store.dispatch(PathwayDiagramObjectActions.set_pathway_diagram_objects({ instances: remainingObjects }));
    // });
  }

  private uploadDiagram(restoreEditing: boolean = true, onComplete?: () => void) {
    if (this.isUploadInProgress)
      return;
    // Check if PathwayDiagram is being edited. If PathwayDiagram is not being edited,
    // tell the user nothing to be uploaded.
    this.pathwayDiagramId = this.diagramLockInfo?.diagramDbId ? this.diagramLockInfo.diagramDbId.toString() : this.pathwayDiagramId;
    if (this.pathwayDiagramId !== undefined && this.pathwayDiagramId.length === 0) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'The diagram is not being edited. Nothing to be uploaded.'
        }
      });
      if (onComplete)
        onComplete();
      return;
    }
    const wasEditing = this.isEditing;
    // Make sure disable diagram first
    if (wasEditing)
      this.diagramUtils.disableEditing(this.diagram);
    // cy refers to itself. This creates a circular structure.
    // Need to do a little bit of workaround here.
    // Get rid of any circular structure by doing the following fixes
    const networkJson = this.generateNetworkJson();
    this.isUploadInProgress = true;
    this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
      disableClose: true,
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: false
    });

    // Use pathwayDiagramId, instead of pathwayId for uploading
    this.diagramUtils.getDataService().uploadCytoscapeNetwork(this.pathwayDiagramId, networkJson).subscribe({
      next: (success) => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
        this.isUploadInProgress = false;
        const dialogConfig = {
          data: {
            title: success ? 'Information' : 'Error',
            message: success ? 'The diagram has been uploaded successfully.' : 'The diagram has not been uploaded successfully.'
          }
        };
        this.dialog.open(InfoDialogComponent, dialogConfig);
        if (success) {
          // After uploading, we can consider the diagram is not edited anymore. So reset the flag.
          this.isEdited = false;
          this.clearDiagramDraftFromSessionStorage();
        }
        if (wasEditing && restoreEditing)
          this.enableEditing();
        if (onComplete)
          onComplete();
      },
      error: (error: Error) => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
        this.isUploadInProgress = false;
        // There is no need to show the error message. the Data service should handle it already.
        // this.dialog.open(InfoDialogComponent, {
        //   data: {
        //     title: 'Error',
        //     message: error?.message || 'Failed to upload the diagram.'
        //   }
        // });
        if (wasEditing && restoreEditing)
          this.enableEditing();
        if (onComplete)
          onComplete();
      }
    });
  }

  private generateNetworkJson() {
    const nodes = this.diagram.cy.nodes().jsons();
    const edges = this.diagram.cy.edges().jsons();
    const elements = {
      nodes: nodes,
      edges: edges
    };
    // Include minimal metadata (viewport and style) so staged snapshots render
    // more like the server-provided diagrams when reloaded.
    const metadata = {
      zoom: this.diagram.cy.zoom(),
      pan: this.diagram.cy.pan(),
      style: undefined
    };
    try {
      // style().json() can be expensive or large; include it conditionally.
      metadata.style = this.diagram.cy.style().json();
    }
    catch (e) {
      metadata.style = undefined;
    }

    const networkJson = {
      elements: elements,
      metadata: metadata
    };
    return networkJson;
  }

  private applyNetworkMetadata(network: any) {
    try {
      if (!network) return;
      const metadata = network.metadata ?? network?.network?.metadata;
      if (!metadata) return;
      if (metadata.style && this.diagram?.cy?.style) {
        try {
          this.diagram.cy.style().fromJson(metadata.style);
        }
        catch (e) {
          // ignore style application errors
        }
      }
      if (metadata.zoom !== undefined && typeof metadata.zoom === 'number') {
        try { this.diagram.cy.zoom(metadata.zoom); } catch (e) { }
      }
      if (metadata.pan && typeof metadata.pan === 'object') {
        try { this.diagram.cy.pan(metadata.pan); } catch (e) { }
      }
    }
    catch (e) {
      // ignore
    }
  }

  private markDiagramEdited() {
    this.isEdited = true;
    // Keep staged edits current in the store; backend flush happens on timer/logout.
    const lockInfo = this.diagramLockInfo ?? ({ diagramDbId: Number(this.pathwayDiagramId ?? this.diagram?.diagramId) } as DiagramLock);
    this.stagePathwayDiagramObject(lockInfo);
  }

  private persistDiagramDraftToSessionStorage(diagramLock: DiagramLock, networkJson?: any) {
    if (!diagramLock || !this.isLockOwnedByCurrentUser(diagramLock) || !this.pathwayId || !this.diagram?.cy)
      return;
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return;
    const draft: PendingDiagramDraft = {
      pathwayId: this.pathwayId,
      diagramLock: diagramLock,
      network: networkJson ?? this.generateNetworkJson(),
      username: currentUser,
      savedAt: new Date().toISOString()
    };
    sessionStorage.setItem(this.pendingDiagramDraftSessionKey, JSON.stringify(draft));
    this.savePathwayDiagramLockRef(diagramLock, this.pathwayId);
    this.stagePathwayDiagramObject(diagramLock);
  }

  private getPendingDiagramDraftFromSessionStorage(): PendingDiagramDraft | null {
    const rawDraft = sessionStorage.getItem(this.pendingDiagramDraftSessionKey);
    if (!rawDraft)
      return null;
    try {
      return JSON.parse(rawDraft) as PendingDiagramDraft;
    }
    catch (error) {
      console.warn('Failed to parse pending diagram draft from session storage.', error);
      this.clearDiagramDraftFromSessionStorage();
      return null;
    }
  }

  private getPendingDraftNetworkForPathway(pathwayDbId: number): any | undefined {
    const pendingDraft = this.getPendingDiagramDraftFromSessionStorage();
    if (!pendingDraft)
      return undefined;
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0 || pendingDraft.username !== currentUser)
      return undefined;
    const draftPathwayDbId = Number(pendingDraft.pathwayId);
    if (!Number.isFinite(draftPathwayDbId) || draftPathwayDbId !== Number(pathwayDbId))
      return undefined;
    const network = pendingDraft.network?.elements
      ? pendingDraft.network
      : pendingDraft.network?.network?.elements
        ? pendingDraft.network.network
        : undefined;
    return network;
  }

  private clearDiagramDraftFromSessionStorage() {
    sessionStorage.removeItem(this.pendingDiagramDraftSessionKey);
  }

  private stagePathwayDiagramObject(diagramLock: DiagramLock) {
    // Always attempt to stage the current in-memory edits so they can be recovered later.
    const parsedPathwayDbId = parseInt(this.pathwayId || '');
    const pathwayDbId = Number.isFinite(parsedPathwayDbId) ? parsedPathwayDbId : 0;

    const lockInfo = diagramLock ?? ({} as DiagramLock);
    const parsedDiagramDbId = Number(lockInfo?.diagramDbId);

    // Prefer the currently-displayed diagram id when staging so it matches
    // the id used during load-time resolution. Fallback order:
    // 1) this.diagram.diagramId (displayed), 2) lock.diagramDbId, 3) pathwayDbId, 4) unique negative id.
    const currentDisplayedDiagramId = Number(this.diagram?.diagramId);
    let pathwayDiagramDbId: number;
    if (Number.isFinite(currentDisplayedDiagramId) && currentDisplayedDiagramId > 0) {
      pathwayDiagramDbId = currentDisplayedDiagramId;
    } else if (Number.isFinite(parsedDiagramDbId) && parsedDiagramDbId > 0) {
      pathwayDiagramDbId = parsedDiagramDbId;
    } else if (pathwayDbId > 0) {
      pathwayDiagramDbId = pathwayDbId;
    } else {
      pathwayDiagramDbId = -Date.now();
    }

    this.savePathwayDiagramLockRef(lockInfo, this.pathwayId);

    const pathwayDiagramObject: PathwayDiagramObject = {
      network: this.generateNetworkJson(),
      pathwayDbId: pathwayDbId,
      pathwayDiagramDbId: pathwayDiagramDbId,
      diagramLock: lockInfo
    };

    this.store.dispatch(PathwayDiagramObjectActions.register_pathway_diagram_object(pathwayDiagramObject));
    try {
      // Write a per-action localStorage entry immediately so other tabs receive the storage event.
      localStorage.setItem(PathwayDiagramObjectActions.register_pathway_diagram_object.type,
        JSON.stringify({ object: JSON.stringify(pathwayDiagramObject), timestamp: Date.now() }));
    }
    catch (e) {
      // ignore localStorage errors (e.g. in private mode)
    }
  }

  private restorePendingDiagramDraft(expectedPathwayId: string, loadRequestId: number) {
    if (!this.isDiagramLoadRequestActive(loadRequestId) || this.pathwayId !== expectedPathwayId)
      return;

    const pendingDraft = this.getPendingDiagramDraftFromSessionStorage();
    if (!pendingDraft || pendingDraft.pathwayId !== expectedPathwayId)
      return;
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0 || pendingDraft.username !== currentUser)
      return;
    if (!pendingDraft.diagramLock?.diagramDbId || !pendingDraft.network)
      return;
    const draftSavedAtMs = new Date(pendingDraft.savedAt || '').getTime();
    const exactSavedSnapshot = this.getExactSavedSnapshotMeta(pendingDraft.diagramLock.diagramDbId, Number(expectedPathwayId));
    const exactSavedAtMs = new Date(exactSavedSnapshot?.savedAt || '').getTime();
    if (Number.isFinite(draftSavedAtMs) && Number.isFinite(exactSavedAtMs) && exactSavedAtMs >= draftSavedAtMs) {
      this.debugDiagramReload(`Skipping stale pending draft recovery for pathwayDbId=${expectedPathwayId}. exactSavedAt=${exactSavedSnapshot?.savedAt}, draftSavedAt=${pendingDraft.savedAt}.`);
      this.clearDiagramDraftFromSessionStorage();
      return;
    }
    // Recover unsaved draft into local staged store only; backend sync is periodic/logout-based.
    this.clearDiagramDraftFromSessionStorage();
    this.isEdited = false;
    this.diagramLockInfo = pendingDraft.diagramLock;
    this.savePathwayDiagramLockRef(pendingDraft.diagramLock, expectedPathwayId);
    this.pathwayDiagramId = pendingDraft.diagramLock.diagramDbId.toString();
    this.stagePathwayDiagramObject(pendingDraft.diagramLock);
    this.loadPathwayDiagram();
  }

  private createAndOpenNewPathwayDiagram() {
    const dataService = this.diagramUtils.getDataService();
    dataService.fetchInstance(parseInt(this.pathwayId)).subscribe((pathwayInstance: Instance) => {
      if (!pathwayInstance)
        return;
      dataService.createNewInstance('PathwayDiagram').subscribe((newPathwayDiagram: Instance) => {
        if (newPathwayDiagram && newPathwayDiagram.attributes) {
          const pathwayShell = this.instUtil.makeShell(pathwayInstance);
          newPathwayDiagram.attributes.set('representedPathway', [pathwayShell]);
          // This is based on InstanceNameGenerator. Better to call that function!
          newPathwayDiagram.displayName = 'Diagram of ' + pathwayInstance.displayName;
          newPathwayDiagram.attributes.set('displayName', newPathwayDiagram.displayName);
          // Register the new instance so it can be referenced
          dataService.registerInstance(newPathwayDiagram);
          this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtil.makeShell(newPathwayDiagram)));
          this.openPathwayDiagramEvent.emit(newPathwayDiagram.dbId);
        }
      });
    });
  }

  private disableResize() {
    this.diagramUtils.disableResizeCompartment(this.elementUnderMouse, this.diagram);
    const index = this.resizingNodes.indexOf(this.elementUnderMouse);
    if (index >= 0)
      this.resizingNodes.splice(index, 1);
  }

  handleReactomeEvent(event: any) {
    const reactomeEvent = event as ReactomeEvent;
    // Forward event selection
    // Turn this on only for debug select. Need this for all events
    // if (reactomeEvent.type !== ReactomeEventTypes.select) {
    //   return;
    // }
    // Apparently we cannot use isNode or isEdge to check the detail's type.
    // We have to use this way to check if a reaction or a node is used.
    let reactomeId = event.detail.reactomeId;
    let affectedElms = undefined;
    if (reactomeEvent.detail.type !== 'reaction') { // Check for node attachment only
      affectedElms = this.diagram.cy.nodes().filter((node: any) => {
        // This is for nodeAttachments!
        return node.data('nodeReactomeId') && node.data('nodeReactomeId') === reactomeId;
      }
      );
    }
    else {
      // We'd like to get the reaction node too. Therefore, scan all elements.
      affectedElms = this.diagram.cy.elements().filter((elm: any) => {
        return (elm.data('reactomeId') && (elm.data('reactomeId') === reactomeId)) ||
          (elm.data('nodeReactomeId') && (elm.data('nodeReactomeId') === reactomeId));
      });
    }
    if (affectedElms === undefined || affectedElms.length === 0)
      return;
    this.diagram.applyEvent(event, affectedElms);
  }

  addEvent(event: Instance) {
    if (this.diagramUtils.isEventAdded(event, this.diagram.cy)) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Error',
          message: 'This event has been added in the diagram already: ',
          instanceInfo: event.displayName + '[' + event.dbId + ']'
        }
      });
      return;
    }
    // Need to enable editing first
    if (!this.isEditing) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Error',
          message: 'Editing must be enabled before adding a new event.',
          instanceInfo: event.displayName + '[' + event.dbId + ']'
        }
      });
      return;
    }
    this.diagramUtils.addNewEvent(event, this.diagram.cy);
    this.markDiagramEdited();
  }

  private alignNodesVertically() {
    if (!this.diagram?.cy) return;

    const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
      return this.isNodeForAlignment(node);
    });
    if (selectedNodes.length < 2) return;

    // Calculate the average x position (vertical center line)
    let totalX = 0;
    selectedNodes.forEach((node: any) => {
      totalX += node.position('x');
    });
    const averageX = totalX / selectedNodes.length;

    // Move all nodes to the average x position and their modification nodes
    selectedNodes.forEach((node: any) => {
      const oldX = node.position('x');
      const deltaX = averageX - oldX;

      node.position('x', averageX);

      // Move associated modification nodes
      const reactomeId = node.data('reactomeId');
      const modificationNodes = this.diagram.cy.nodes().filter((modNode: any) => {
        return modNode.data('nodeReactomeId') === reactomeId && modNode.hasClass('Modification');
      });

      modificationNodes.forEach((modNode: any) => {
        const modPos = modNode.position();
        modNode.position({
          x: modPos.x + deltaX,
          y: modPos.y
        });
      });
    });
  }

  private alignNodesHorizontally() {
    if (!this.diagram?.cy) return;

    const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
      return this.isNodeForAlignment(node);
    });
    if (selectedNodes.length < 2) return;

    // Calculate the average y position (horizontal center line)
    let totalY = 0;
    selectedNodes.forEach((node: any) => {
      totalY += node.position('y');
    });
    const averageY = totalY / selectedNodes.length;

    // Move all nodes to the average y position and their modification nodes
    selectedNodes.forEach((node: any) => {
      const oldY = node.position('y');
      const deltaY = averageY - oldY;

      node.position('y', averageY);

      // Move associated modification nodes
      const reactomeId = node.data('reactomeId');
      const modificationNodes = this.diagram.cy.nodes().filter((modNode: any) => {
        return modNode.data('nodeReactomeId') === reactomeId && modNode.hasClass('Modification');
      });

      modificationNodes.forEach((modNode: any) => {
        const modPos = modNode.position();
        modNode.position({
          x: modPos.x,
          y: modPos.y + deltaY
        });
      });
    });
  }

  /**
   * Check if a node should be used for alignment
   * @param node
   * @returns 
   */
  private isNodeForAlignment(node: any): boolean {
    return node.hasClass('PhysicalEntity') || (node.hasClass('reaction') && !node.hasClass(EDGE_POINT_CLASS));
  }

  private getStoredExactSavedDiagramNetworks(): Record<string, StoredExactSavedDiagramNetwork> {
    const raw = localStorage.getItem(this.exactSavedDiagramNetworksStorageKey);
    if (!raw)
      return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
      return {};
    }
  }

  private saveExactSavedNetwork(diagramDbId: number, networkJson: any, pathwayId: string | number) {
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    const normalizedDiagramDbId = Number(diagramDbId);
    const normalizedPathwayDbId = Number(pathwayId);
    if (currentUser.length === 0)
      return;
    if (!Number.isFinite(normalizedDiagramDbId) || normalizedDiagramDbId <= 0)
      return;
    if (!Number.isFinite(normalizedPathwayDbId) || normalizedPathwayDbId <= 0)
      return;
    if (!networkJson)
      return;

    const networks = this.getStoredExactSavedDiagramNetworks();
    networks[`${currentUser}:${normalizedDiagramDbId}`] = {
      diagramDbId: normalizedDiagramDbId,
      pathwayDbId: normalizedPathwayDbId,
      // Keep an immutable snapshot to avoid accidental mutation by later edits.
      network: JSON.parse(JSON.stringify(networkJson)),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(this.exactSavedDiagramNetworksStorageKey, JSON.stringify(networks));
    this.debugDiagramReload(`Stored exact saved snapshot for diagramDbId=${normalizedDiagramDbId}, pathwayDbId=${normalizedPathwayDbId}.`);
  }

  private getExactSavedNetwork(diagramDbId?: number, pathwayDbId?: number): any | undefined {
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return undefined;

    const networks = this.getStoredExactSavedDiagramNetworks();
    if (diagramDbId && Number.isFinite(Number(diagramDbId)) && Number(diagramDbId) > 0) {
      const entry = networks[`${currentUser}:${Number(diagramDbId)}`];
      // const directNetwork = this.extractNetworkFromStagedObject({ object: entry?.network } as PathwayDiagramObject);
      // if (directNetwork)
      //   return directNetwork;
    }

    if (pathwayDbId && Number.isFinite(Number(pathwayDbId)) && Number(pathwayDbId) > 0) {
      let latest: StoredExactSavedDiagramNetwork | undefined;
      Object.keys(networks).forEach((key: string) => {
        if (!key.startsWith(`${currentUser}:`))
          return;
        const entry = networks[key];
        if (!entry || Number(entry.pathwayDbId) !== Number(pathwayDbId))
          return;
        if (!latest || (new Date(entry.savedAt).getTime() > new Date(latest.savedAt).getTime()))
          latest = entry;
      });
      // if (latest) {
      //   const pathwayNetwork = this.extractNetworkFromStagedObject({ object: latest.network } as PathwayDiagramObject);
      //   if (pathwayNetwork)
      //     return pathwayNetwork;
      // }
    }

    return undefined;
  }

  private getExactSavedSnapshotMeta(diagramDbId?: number, pathwayDbId?: number): StoredExactSavedDiagramNetwork | undefined {
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return undefined;

    const networks = this.getStoredExactSavedDiagramNetworks();
    if (diagramDbId && Number.isFinite(Number(diagramDbId)) && Number(diagramDbId) > 0) {
      const direct = networks[`${currentUser}:${Number(diagramDbId)}`];
      if (direct)
        return direct;
    }

    if (pathwayDbId && Number.isFinite(Number(pathwayDbId)) && Number(pathwayDbId) > 0) {
      let latest: StoredExactSavedDiagramNetwork | undefined;
      Object.keys(networks).forEach((key: string) => {
        if (!key.startsWith(`${currentUser}:`))
          return;
        const entry = networks[key];
        if (!entry || Number(entry.pathwayDbId) !== Number(pathwayDbId))
          return;
        if (!latest || (new Date(entry.savedAt).getTime() > new Date(latest.savedAt).getTime()))
          latest = entry;
      });
      return latest;
    }

    return undefined;
  }

  private getStoredPathwayDiagramLockRefs(): Record<string, StoredPathwayDiagramLockRef> {
    const raw = localStorage.getItem(this.pathwayDiagramLockRefsStorageKey);
    if (!raw)
      return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
      return {};
    }
  }

  private tryRestoreLockStateFromStoredRef() {
    const pathwayDbId = Number(this.pathwayId);
    if (!Number.isFinite(pathwayDbId) || pathwayDbId <= 0)
      return;

    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return;

    const refs = this.getStoredPathwayDiagramLockRefs();
    const ref = refs[`${currentUser}:${pathwayDbId}`];
    if (!ref?.diagramDbId)
      return;

    const restoredLock: DiagramLock = {
      diagramDbId: ref.diagramDbId,
      lockId: ref.lockId ?? '',
      username: currentUser,
      lockedAt: ref.updatedAt,
      locked: true
    };

    // Set optimistic state so the lock icon shows and the staged diagram loads immediately.
    // This will be reverted if the backend verification below finds the lock is no longer ours.
    this.diagramLockInfo = restoredLock;
    this.pathwayDiagramId = ref.diagramDbId.toString();
    this.diagram.diagramId = ref.diagramDbId.toString();
    this.lockStatus = 'acquired';
    this.lockStatusMessage = 'Lock acquired. Editing is available.';
    this.isEditing = true;
    this.isEdited = !!this.getExactSavedNetwork(ref.diagramDbId, pathwayDbId);

    // Verify with the backend that we still own this lock.
    // This prevents stale localStorage entries from bypassing mutual exclusion.
    const snapshotPathwayId = this.pathwayId;
    this.diagramUtils.getDataService().fetchPathwayDiagram(snapshotPathwayId).subscribe({
      next: (pathwayDiagram) => {
        if (!pathwayDiagram || this.pathwayId !== snapshotPathwayId)
          return;
        this.diagramUtils.getDataService().lockDiagram(pathwayDiagram).pipe(take(1)).subscribe({
          next: (verifiedLock) => {
            if (this.pathwayId !== snapshotPathwayId)
              return;
            if (this.isLockOwnedByCurrentUser(verifiedLock)) {
              // Lock confirmed — update with authoritative lock info from backend.
              this.diagramLockInfo = verifiedLock;
              this.savePathwayDiagramLockRef(verifiedLock, snapshotPathwayId);
              this.updateLockStatus(verifiedLock);
            } else {
              // Lock is no longer ours — clear local state and reload the canonical diagram.
              console.warn('Stored lock ref could not be verified with backend. Clearing edit state.');
              this.clearAssociatedDiagramEdits(ref.diagramDbId, pathwayDbId);
              this.resetDiagramLockState();
              this.showDiagramLockedDialog(verifiedLock);
              const reloadRequestId = this.beginDiagramLoadRequest();
              this.diagram.diagramId = snapshotPathwayId;
              this.loadPathwayDiagramFromBackend(reloadRequestId);
            }
          },
          error: () => {
            if (this.pathwayId !== snapshotPathwayId)
              return;
            // If verification errors, play it safe and clear edit state.
            console.warn('Backend lock verification failed. Clearing edit state.');
            this.resetDiagramLockState();
            const reloadRequestId = this.beginDiagramLoadRequest();
            this.diagram.diagramId = snapshotPathwayId;
            this.loadPathwayDiagramFromBackend(reloadRequestId);
          }
        });
      },
      error: () => { /* ignore — optimistic state already set */ }
    });
  }

  private savePathwayDiagramLockRef(diagramLock: DiagramLock, pathwayId: string | number) {
    const normalizedPathwayDbId = Number(pathwayId);
    const normalizedDiagramDbId = Number(diagramLock?.diagramDbId);
    if (!Number.isFinite(normalizedPathwayDbId) || normalizedPathwayDbId <= 0)
      return;
    if (!Number.isFinite(normalizedDiagramDbId) || normalizedDiagramDbId <= 0)
      return;

    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return;

    const refs = this.getStoredPathwayDiagramLockRefs();
    refs[`${currentUser}:${normalizedPathwayDbId}`] = {
      diagramDbId: normalizedDiagramDbId,
      lockId: diagramLock.lockId,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(this.pathwayDiagramLockRefsStorageKey, JSON.stringify(refs));
  }

  private getSavedDiagramDbIdForPathway(pathwayDbId: number): number | undefined {
    const normalizedPathwayDbId = Number(pathwayDbId);
    if (!Number.isFinite(normalizedPathwayDbId) || normalizedPathwayDbId <= 0)
      return undefined;

    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return undefined;

    const refs = this.getStoredPathwayDiagramLockRefs();
    const ref = refs[`${currentUser}:${normalizedPathwayDbId}`];
    const normalizedDiagramDbId = Number(ref?.diagramDbId);
    if (!Number.isFinite(normalizedDiagramDbId) || normalizedDiagramDbId <= 0)
      return undefined;
    return normalizedDiagramDbId;
  }

  private removeSavedDiagramDbIdForPathway(pathwayDbId?: number) {
    const normalizedPathwayDbId = Number(pathwayDbId);
    if (!Number.isFinite(normalizedPathwayDbId) || normalizedPathwayDbId <= 0)
      return;

    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return;

    const refs = this.getStoredPathwayDiagramLockRefs();
    const refKey = `${currentUser}:${normalizedPathwayDbId}`;
    if (!(refKey in refs))
      return;

    delete refs[refKey];
    localStorage.setItem(this.pathwayDiagramLockRefsStorageKey, JSON.stringify(refs));
  }

  private removeExactSavedNetwork(diagramDbId?: number, pathwayDbId?: number) {
    const currentUser = (this.authService.getUser() || '').trim().toLowerCase();
    if (currentUser.length === 0)
      return;

    const normalizedDiagramDbId = Number(diagramDbId);
    const normalizedPathwayDbId = Number(pathwayDbId);
    const removeByDiagramDbId = Number.isFinite(normalizedDiagramDbId) && normalizedDiagramDbId > 0;
    const removeByPathwayDbId = Number.isFinite(normalizedPathwayDbId) && normalizedPathwayDbId > 0;
    if (!removeByDiagramDbId && !removeByPathwayDbId)
      return;

    const networks = this.getStoredExactSavedDiagramNetworks();
    let hasChanges = false;

    Object.keys(networks).forEach((key: string) => {
      if (!key.startsWith(`${currentUser}:`))
        return;

      const entry = networks[key];
      if (!entry)
        return;

      const matchesDiagramDbId = removeByDiagramDbId && Number(entry.diagramDbId) === normalizedDiagramDbId;
      const matchesPathwayDbId = removeByPathwayDbId && Number(entry.pathwayDbId) === normalizedPathwayDbId;
      if (!matchesDiagramDbId && !matchesPathwayDbId)
        return;

      delete networks[key];
      hasChanges = true;
    });

    if (hasChanges)
      localStorage.setItem(this.exactSavedDiagramNetworksStorageKey, JSON.stringify(networks));
  }

  private isDiagramReloadDebugEnabled(): boolean {
    const queryFlag = (this.route.snapshot.queryParams['diagramReloadDebug'] || '').toString().toLowerCase();
    if (queryFlag === '1' || queryFlag === 'true' || queryFlag === 'yes' || queryFlag === 'on')
      return true;
    const storageFlag = (localStorage.getItem(this.diagramReloadDebugStorageKey) || '').toLowerCase();
    return storageFlag === '1' || storageFlag === 'true' || storageFlag === 'yes' || storageFlag === 'on';
  }

  private debugDiagramReload(message: string) {
    if (!this.isDiagramReloadDebugEnabled())
      return;
    console.debug(`[diagram-reload-debug] ${message}`);
  }

}

