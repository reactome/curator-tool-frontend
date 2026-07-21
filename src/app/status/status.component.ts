import { Component, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance, MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';
import { defaultPerson, deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { bookmarkedInstances } from "../schema-view/instance-bookmark/state/bookmark.selectors";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { UserInstancesService } from "../auth/login/user-instances.service";
import { ListInstancesDialogService } from "../schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service";
import { DefaultPersonActions } from "../instance/state/instance.actions";
import { DataService } from "../core/services/data.service";
import { Subscription, combineLatest, debounceTime, skip, take } from "rxjs";
import { DiagramEditorService, DiagramLockViewModel } from '../event-view/components/pathway-diagram/utils/diagram-editor.service';
import { UserInstanceBackupsDialogService } from './components/user-instance-backups-dialog/user-instance-backups-dialog.service';
import { UnsavedUploadDialogComponent } from "../shared/components/unsaved-upload-dialog/unsaved-upload-dialog.component";
import { CommitWaitDialogComponent } from "../shared/components/commit-wait-dialog/commit-wait-dialog.component";

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
})
export class StatusComponent implements OnInit, OnDestroy {
  @Input() hideInstanceStatus: boolean = false;
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  bookmarkedInstances: Instance[] = [];
  // pathwayDiagramCount: number = 0;
  showPathwayDiagramLocksPanel: boolean = false;
  pathwayDiagramLocksLoading: boolean = false;
  pathwayDiagramLocks: DiagramLockViewModel[] = [];
  defaultPerson: Instance | undefined = undefined;
  saveChangesInProgress: boolean = false;
  currentUrl: string = '';

  private subscriptions: Subscription = new Subscription();

  constructor(private store: Store,
    private userInstancesService: UserInstancesService,
    private instanceSelectionService: ListInstancesDialogService,
    private router: Router,
    private dataService: DataService,
    private diagramEditorService: DiagramEditorService,
    private userInstanceBackupsDialogService: UserInstanceBackupsDialogService,
    private dialog: MatDialog) {
  }

  private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;

  private _snackBar = inject(MatSnackBar);

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action);
  }

  ngOnInit(): void {
    this.currentUrl = this.router.url;

    let sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
      }
    });
    this.subscriptions.add(sub);

    // The following code will load all locks from the server and subscribe to any changes. This is necessary to keep the lock status in sync across different browser tabs.
    // Set the loading flag before subscribing: observePathwayDiagramLocksViewModels() is backed by a
    // BehaviorSubject and can emit synchronously when the caches are already warm. If we set it after
    // subscribing, that synchronous emission's loading=false would be immediately overwritten with
    // true and the panel would stay stuck on "Loading locks...".
    this.pathwayDiagramLocksLoading = true;

    sub = this.diagramEditorService.observePathwayDiagramLocksViewModels().subscribe({
      next: (items: DiagramLockViewModel[]) => {
        this.pathwayDiagramLocks = items || [];
        this.pathwayDiagramLocksLoading = false;
      },
      error: () => {
        this.pathwayDiagramLocks = [];
        this.pathwayDiagramLocksLoading = false;
      }
    });
    this.subscriptions.add(sub);

    sub = this.store.select(updatedInstances()).subscribe((instances) => {
      instances ? this.updatedInstances = instances : this.updatedInstances = [];
    });
    this.subscriptions.add(sub);

    sub = this.store.select(newInstances()).subscribe((instances) => {
      instances ? this.newInstances = instances : this.newInstances = [];
    });
    this.subscriptions.add(sub);

    sub = this.store.select(deleteInstances()).subscribe((instances) => {
      instances ? this.deletedInstances = instances : this.deletedInstances = [];
    });
    this.subscriptions.add(sub);

    // Combine deleted, new, and updated instances into a single array.

    sub = combineLatest([
      this.store.select(deleteInstances()),
      this.store.select(newInstances()),
      this.store.select(updatedInstances())
    ]).subscribe(([deleted, created, updated]) => {
      const stagedCount = (deleted?.length || 0)
        + (created?.length || 0)
        + (updated?.length || 0);
      this.saveChangesInProgress = stagedCount > MAX_STAGED_INSTANCES;
    })
    this.subscriptions.add(sub);

    sub = this.store.select(bookmarkedInstances()).subscribe((instances) => {
      instances ? this.bookmarkedInstances = instances : this.bookmarkedInstances = [];
    });
    this.subscriptions.add(sub);

    sub = this.store.select(defaultPerson()).subscribe((instances) => {
      // There should be only one default person
      instances && instances.length > 0 ? this.defaultPerson = instances[0] : this.defaultPerson = undefined
    });
    this.subscriptions.add(sub);

    // Auto-persist after 5 minutes of no edit activity across all tracked state
    sub = combineLatest([
      this.store.select(updatedInstances()),
      this.store.select(newInstances()),
      this.store.select(deleteInstances()),
      this.store.select(defaultPerson()),
    ]).pipe(
      skip(1), // ignore the initial emission on subscription
      debounceTime(5 * 60 * 1000)
    ).subscribe(() => {
      console.debug('StatusComponent: no edit activity for 5 minutes, auto-persisting...');
      this.userInstancesService.persistInstances();
    });
    this.subscriptions.add(sub);

    sub = this.dataService.errorMessage$.subscribe((message: Error) => {
      if (message) {
        // Filter out refresh token expired errors
        const messageString = (message.message || '').toLowerCase();
        
        if (messageString.includes('refresh token') || 
            messageString.includes('token expired') || 
            messageString.includes('api/auth')) { // Don't show any error related to login/refresh.
          return; // Skip displaying refresh token errors
        }
        
        if (message.message) {
          this.openSnackBar(message.message, 'Close');
        } else {
          this.openSnackBar("There is an error: " + message.name, 'Close');
        }
      }
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Calling ngOnDestroy is not reliable: https://blog.devgenius.io/where-ngondestroy-fails-you-54a8c2eca0e0.
  @HostListener('window:beforeunload')
  persistInstances(): void {
    this.userInstancesService.persistInstances();
  }

  showUpdated(): void {
    this.showUpdatedEvent.emit(true);
  }

  togglePathwayDiagramLocksPanel(): void {
    this.showPathwayDiagramLocksPanel = !this.showPathwayDiagramLocksPanel;
  }

  @HostListener('document:click', ['$event'])
  closePathwayDiagramLocksPanelOnOutsideClick(event: MouseEvent): void {
    if (!this.showPathwayDiagramLocksPanel)
      return;

    const target = event.target as HTMLElement | null;
    if (!target)
      return;

    if (target.closest('.diagram-locks-wrapper'))
      return;

    this.showPathwayDiagramLocksPanel = false;
  }

  setDefaultPerson(): void {
    // Set or change the default person instance
    const matDialogRef = this.instanceSelectionService.openDialog({ schemaClass: { name: 'Person' }, title: 'Select default person' });
    matDialogRef.afterClosed().subscribe((result) => {
      if (result)
        this.store.dispatch(DefaultPersonActions.set_default_person(result as Instance))
    });
  }

  logout() {
    this.userInstancesService.persistInstances(true, () => {
      this.router.navigate(["/login"]);
    });
  }

  navigateHome() {
    this.router.navigate(["/home"]);
  }

  openUserInstanceBackups(): void {
    this.userInstanceBackupsDialogService.openDialog();
  }

  navigateToSchemaView() {
    this.router.navigate(["/schema_view"]);
  }

  navigateToEventView() {
    this.router.navigate(["/event_view"]);
  }

  openPathwayDiagram(diagramDbId: number) {
    if (!Number.isFinite(Number(diagramDbId))) return;
    // Navigate to the event view and load the instance for the diagram
    this.router.navigate(["/event_view", "instance", Number(diagramDbId)]);
  }

  unlockPathwayDiagram(lock: DiagramLockViewModel): void {
    const lockInfo = this.diagramEditorService.getCachedDiagramLock(lock.diagramDbId);
    if (!lockInfo) {
      this.openSnackBar('Unable to unlock this diagram: lock information is unavailable.', 'Close');
      return;
    }

    // On success the service removes the lock from its cache and re-emits, which
    // updates pathwayDiagramLocks (and the panel list) via the subscription in ngOnInit.
    const finalizeUnlock = () => {
      this.diagramEditorService.unlockDiagram(lockInfo).subscribe({
        next: () => this.openSnackBar(`Unlocked "${lock.displayName}".`, 'Close'),
        error: () => this.openSnackBar(`Failed to unlock "${lock.displayName}".`, 'Close'),
      });
    };

    // No unsaved backup means there is nothing to upload, so unlock directly. This mirrors
    // the editor's promptUploadBeforeDiscard flow, where the prompt is skipped when !isEdited.
    if (!lock.hasBackupDiagram) {
      finalizeUnlock();
      return;
    }

    // Unsaved edits for a diagram that is not open in the editor live in a server-side backup.
    // Offer the same upload / discard / cancel choices the editor gives when unlocking.
    const dialogRef = this.dialog.open(UnsavedUploadDialogComponent, {
      data: {
        title: 'Unsaved Changes',
        message: `"${lock.displayName}" has unsaved changes. Upload before unlocking this diagram?`
      },
      disableClose: true
    });
    dialogRef.afterClosed().pipe(take(1)).subscribe((shouldUpload: boolean | null) => {
      if (shouldUpload === true)
        this.uploadBackupThenUnlock(lock, finalizeUnlock);
      else if (shouldUpload === false)
        finalizeUnlock(); // Discard the backup and unlock.
      // null => Cancel: leave the diagram locked and its backup intact.
    });
  }

  private uploadBackupThenUnlock(lock: DiagramLockViewModel, finalizeUnlock: () => void): void {
    const defaultPersonId = this.defaultPerson?.dbId;
    if (defaultPersonId === undefined) {
      this.openSnackBar('Cannot find the default person. Upload aborted; diagram not unlocked.', 'Close');
      return;
    }

    this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
      disableClose: true,
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: false
    });

    this.diagramEditorService.uploadBackupCyNetwork(lock.diagramDbId, defaultPersonId).pipe(take(1)).subscribe({
      next: (success) => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
        if (success) {
          this.openSnackBar(`Uploaded changes for "${lock.displayName}".`, 'Close');
          finalizeUnlock();
        } else {
          // Keep the diagram locked so the backed-up edits are not lost.
          this.openSnackBar(`Failed to upload changes for "${lock.displayName}". Diagram left locked.`, 'Close');
        }
      },
      error: () => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
        this.openSnackBar(`Failed to upload changes for "${lock.displayName}". Diagram left locked.`, 'Close');
      }
    });
  }

  showSchemaViewButton(): boolean {
    return this.currentUrl.includes('/event_view') || this.currentUrl.includes('/home');
  }

  showEventViewButton(): boolean {
    return this.currentUrl.includes('/schema_view') || this.currentUrl.includes('/home');
  }

  reportBug() {
    window.open("https://docs.google.com/document/d/180LCXdsk7Z324uK0FVhDj5fw3HnFPktt6rEqkpass1o/edit?tab=t.0-report", "_blank");
  }

}
