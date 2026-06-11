import { Component, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { DiagramLock, Instance, MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';
import { defaultPerson, deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { bookmarkedInstances } from "../schema-view/instance-bookmark/state/bookmark.selectors";
import { MatSnackBar } from "@angular/material/snack-bar";
import { UserInstancesService } from "../auth/login/user-instances.service";
import { ListInstancesDialogService } from "../schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service";
import { DefaultPersonActions } from "../instance/state/instance.actions";
import { DataService } from "../core/services/data.service";
import { AuthenticateService } from '../core/services/authenticate.service';
import { Subscription, combineLatest, debounceTime, forkJoin, of, skip, take } from "rxjs";
import { catchError, map } from 'rxjs/operators';

interface DiagramLockViewModel {
  diagramDbId: number;
  lockId: string;
  lockedAt: string;
  displayName: string;
  pathwayDbId?: number;
}

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
    private authService: AuthenticateService) {
  }

  private _snackBar = inject(MatSnackBar);

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action);
  }

  ngOnInit(): void {
    this.currentUrl = this.router.url;

    let sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
        this.loadPathwayDiagramLocks(); // Refresh locks when navigating to make sure the count is up to date
      }
    });
    this.subscriptions.add(sub);

    this.loadPathwayDiagramLocks(); // Refresh locks when navigating to make sure the count is up to date

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

  // private refreshPathwayDiagramCount(): void {
  //   const user = this.authService.getUser();
  //   if (!user) {
  //     this.pathwayDiagramCount = 0;
  //     return;
  //   }
  //   this.dataService.getDiagramLocks().subscribe({
  //     next: (locks) => {
  //       this.pathwayDiagramCount = (locks || []).length;
  //       const stagedCount = (this.deletedInstances?.length || 0)
  //         + (this.newInstances?.length || 0)
  //         + (this.updatedInstances?.length || 0)
  //         + this.pathwayDiagramCount;
  //       this.saveChangesInProgress = stagedCount > MAX_STAGED_INSTANCES;
  //     },
  //     error: () => {
  //       this.pathwayDiagramCount = 0;
  //     }
  //   });
  // }

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
    if (this.showPathwayDiagramLocksPanel)
      this.loadPathwayDiagramLocks();
  }

  private loadPathwayDiagramLocks(): void {
    const user = this.authService.getUser();
    if (!user) {
      this.pathwayDiagramLocks = [];
      this.pathwayDiagramLocksLoading = false;
      return;
    }

    this.pathwayDiagramLocksLoading = true;
    this.dataService.getDiagramLocks().pipe(take(1)).subscribe({
      next: (locks: DiagramLock[]) => {
        const validLocks = (locks || []).filter((lock: DiagramLock) => Number(lock?.diagramDbId) > 0);
        if (validLocks.length === 0) {
          this.pathwayDiagramLocks = [];
          this.pathwayDiagramLocksLoading = false;
          return;
        }

        const requests = validLocks.map((lock: DiagramLock) =>
          this.dataService.fetchInstance(Number(lock.diagramDbId)).pipe(
            take(1),
            map((diagramInst: Instance) => {
              // Try to extract the represented pathway dbId from the PathwayDiagram instance
              let represented = diagramInst?.attributes instanceof Map
                ? diagramInst.attributes.get('representedPathway')
                : diagramInst?.attributes?.representedPathway;
              let pathwayDbId: number | undefined = undefined;
              if (Array.isArray(represented) && represented.length > 0 && represented[0]?.dbId) {
                pathwayDbId = Number(represented[0].dbId);
              }
              return ({
                diagramDbId: Number(lock.diagramDbId),
                lockId: lock.lockId,
                lockedAt: lock.lockedAt,
                displayName: diagramInst?.displayName || `PathwayDiagram ${lock.diagramDbId}`,
                pathwayDbId: pathwayDbId
              }) as DiagramLockViewModel
            }),
            catchError(() => of({
              diagramDbId: Number(lock.diagramDbId),
              lockId: lock.lockId,
              lockedAt: lock.lockedAt,
              displayName: `PathwayDiagram ${lock.diagramDbId}`
            } as DiagramLockViewModel))
          )
        );

        forkJoin(requests).subscribe({
          next: (items: DiagramLockViewModel[]) => {
            this.pathwayDiagramLocks = (items || []).sort((a, b) => {
              const aTime = new Date(a.lockedAt || '').getTime();
              const bTime = new Date(b.lockedAt || '').getTime();
              return bTime - aTime;
            });
            this.pathwayDiagramLocksLoading = false;
          },
          error: () => {
            this.pathwayDiagramLocks = [];
            this.pathwayDiagramLocksLoading = false;
          }
        });
      },
      error: () => {
        this.pathwayDiagramLocks = [];
        this.pathwayDiagramLocksLoading = false;
      }
    });
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
