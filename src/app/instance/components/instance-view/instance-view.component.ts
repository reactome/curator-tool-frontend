import { Component, inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import { NewInstanceActions } from '../../state/instance.actions';
import { DeletionDialogService } from "../deletion-dialog/deletion-dialog.service";
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { ReferrersDialogService } from "../referrers-dialog/referrers-dialog.service";
import { InstanceTableComponent } from './instance-table/instance-table.component';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { combineLatest, Observable, of, Subscription, take, concatMap, finalize } from 'rxjs';
import { ListInstancesDialogService } from 'src/app/schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service';
import { deleteInstances, newInstances, updatedInstances } from '../../state/instance.selectors';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { DeletionService } from '../../deletion-commit/utils/deletion.service';
import { DeletedInstanceAttributeFilter } from 'src/app/core/instance-view-filters/DeletedInstanceAttributeFilter';
import { DisplayNameViewFilter } from 'src/app/core/instance-view-filters/DisplayNameViewFilter';
import { InstanceViewFilter } from 'src/app/core/instance-view-filters/InstanceViewFilter';
import { ReviewStatusUpdateFilter } from 'src/app/core/instance-view-filters/ReviewStatusUpdateFilter';
import { ReviewStatusCheck } from 'src/app/core/post-edit/ReviewStatusCheck';
import { MatchInstancesDialogService } from '../match-instances-dialog/match-instances-dialog.service';
import { MatchedInstancesDialogService } from 'src/app/shared/components/matched-instances-dialog/matched-instances-dialog.service';
import { MatchResolutionService } from 'src/app/core/services/match-resolution.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { CommitWaitDialogComponent } from 'src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component';
import { environment } from 'src/environments/environment.dev';
import { InstanceNameGenerator } from 'src/app/core/post-edit/InstanceNameGenerator';
import { ChangeClassDialogComponent } from '../change-class-dialog/change-class-dialog.component';
import { MergeInstancesDialogService } from '../merge-instances-dialog/merge-instances-dialog.service';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss'],
})

export class InstanceViewComponent implements OnInit, OnDestroy {
  // Used to force the update of table content
  @ViewChild(InstanceTableComponent) instanceTable!: InstanceTableComponent;
  viewHistory: Instance[] = [];
  // instance to be displayed
  instance: Instance | undefined;
  // Control if the instance is loading
  showProgressSpinner: boolean = false;
  // TODO: Try to remove showReferenceColumn and use dbInstance to determine
  // if showReferenceColumn is true.
  // If there id dbInstance, showReferenceColumn is true.
  showReferenceColumn: boolean = false;
  dbInstance: Instance | undefined;
  title: string = '';
  showSecondaryButtons: boolean = false;
  compareInstanceDialogResult$: number = 0;
  qaReportPassed?: boolean;
  qaReportToolTip: string = "Run QA Report";
  instanceViewFilters: InstanceViewFilter[] = [];
  hasPendingStagedInstances: boolean = false;

  // Flag to indicate if this is in event view
  @Input() isInEventView: boolean = false;

  // Control if we need to track the loading history
  @Input() needHistory: boolean = true;
  // Control if the route should be used for the links in the table, bookmarks, etc
  @Input() blockRoute: boolean = false;

  // Flag to avoid update itself
  private commitNewHere: boolean = false;

  // Track subscriptions added so that we can remove them
  private subscriptions: Subscription = new Subscription()

  // Track deleted instances
  private deletedInstances: Instance[] = [];
  private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;

  readonly dialog = inject(MatDialog);
  // block sync view to avoid re-loading the instance for handling URL change
  private blockSyncViewCount: number = 0;
  // dbId of the instance currently being switched to, if any. Loading runs across several async
  // steps (fetch -> view filters -> assignment) and the view filters can themselves fire
  // refreshViewDbId$ for the incoming instance: DisplayNameViewFilter regenerates a display name
  // that differs from the stored one (every Regulation, whose stored name quotes the regulator -
  // "Positive regulation by 'TTC12 [cytosol]'" - while the generator does not) and reports it via
  // registerDisplayNameChange. That notification arrives while this.instance is still the outgoing
  // instance, which usually refers to the incoming one (a reaction listing it under regulatedBy),
  // so the isReferrer branch below would reload the outgoing instance right over the one being
  // opened. See loadInstance().
  private loadingDbId: number | undefined;

  constructor(private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private store: Store,
    private qaReportDialogService: QAReportDialogService,
    private referrersDialogService: ReferrersDialogService,
    private instUtils: InstanceUtilities,
    private deletionDialogService: DeletionDialogService,
    private listInstancesDialogService: ListInstancesDialogService,
    private matchInstancesDialogService: MatchInstancesDialogService,
    private matchedInstancesDialogService: MatchedInstancesDialogService,
    private matchResolutionService: MatchResolutionService,
    private deletionService: DeletionService,
    private reviewStatusCheck: ReviewStatusCheck,
    private commitResultDialogService: CommitResultDialogService,
    private mergeInstancesDialogService: MergeInstancesDialogService
  ) {
    this.instanceViewFilters = this.setUpInstanceViewFilters();

  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    // Handle the loading of instance directly here without using ngrx's effect, which is just
    // too complicated and not necessary here.
    let subscription = this.route.params.subscribe((params) => {
      this.blockSyncView();
      if (params['mode'] && params['mode'] === 'comparison') {
        this.showReferenceColumn = (params['mode'] === 'comparison');
        if (params['dbId']) {
          let dbId = params['dbId'];
          // Make sure dbId is a number
          dbId = parseInt(dbId);
          // This is the case for the default event_view landing page: event_view/instance/0
          if (dbId === 0) {
            this.unblockSyncView();
            return;
          }
          if (params['dbId2']) {
            let dbId2 = params['dbId2'];
            // Make sure dbId2 is a number
            dbId2 = parseInt(dbId2);

            if (dbId === dbId2) {
              this.loadInstance(dbId, true, false, false, false, true)
            }
            else {
              this.loadTwoInstances(dbId, dbId2, true);
            }
          } else {
            this.unblockSyncView();
          }
          //}
          // If no dbId2, the comparison is between the frontend and the database copy
          // else {
          //   this.loadReferenceInstance(dbId);
          // }
        } else {
          this.unblockSyncView();
        }
      }
      else {
        if (params['dbId']) {
          let dbId = params['dbId'];
          // Make sure dbId is a number
          dbId = parseInt(dbId);
          // This is the case for the default event_view landing page: event_view/instance/0
          if (dbId === 0) {
            this.unblockSyncView();
            return;
          }
          this.loadInstance(dbId, false, false, false, false, true);
        } else {
          this.unblockSyncView();
        }
      }
    })
    this.subscriptions.add(subscription);

    subscription = combineLatest([
      this.store.select(newInstances()),
      this.store.select(updatedInstances()),
      this.store.select(deleteInstances())
    ]).subscribe(([stagedNewInstances, stagedUpdatedInstances, stagedDeletedInstances]) => {
      this.hasPendingStagedInstances =
        stagedNewInstances.length > 0 || stagedUpdatedInstances.length > 0 || stagedDeletedInstances.length > 0;
    });
    this.subscriptions.add(subscription);
    // first check isReferrer and then load instances for the past dbId 
    // then check if the displayname is contianed in the modified attributes and if so, reolad the dipslayed instance 
    // first check if modified att has displayname change and if so check referrers and resfresh their view as well 
    subscription = this.instUtils.refreshViewDbId$.subscribe(dbId => {
      if (this.isSyncViewBlocked()) return;
      // A switch to another instance is in flight, so the currently displayed one is on its way
      // out: reloading it here would land after the switch and undo it. The incoming instance is
      // being fetched anyway, so it picks up whatever this notification is about. See loadingDbId.
      if (this.loadingDbId !== undefined) return;
      if (!this.instance) return;
      if (this.instance.dbId === dbId) {
        if (this.instanceTable.inEditing)
          this.updateTitle(this.instance);
        else
          this.loadInstance(dbId, false, false, true);
      }
      else if (this.instUtils.isReferrer(dbId, this.instance)) {
        this.loadInstance(this.instance.dbId, false, false, true);
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.resetInst$.subscribe(data => {
      if (this.isSyncViewBlocked()) return;
      if (!this.instance) return;
      // These two cases work for reset an updated instances
      if (this.instance && this.instance.dbId === data.dbId) {
        this.loadInstance(data.dbId, false, false, true);
      }
      else if (this.instUtils.isReferrer(data.dbId, this.instance)) {
        this.loadInstance(this.instance.dbId, false, false, true);

      }
    });
    this.subscriptions.add(subscription);
    // In case the deleted instance is referred by the current instance
    subscription = this.instUtils.markDeletionDbId$.subscribe(dbId => {
      if (this.isSyncViewBlocked()) return;
      if (this.instance && this.instUtils.isReferrer(dbId, this.instance)) {
        this.loadInstance(this.instance.dbId, false, false, true, false);
      }
    });
    this.subscriptions.add(subscription);
    // When a deletion is committed. 
    subscription = this.instUtils.deletedDbId$.subscribe(dbId => {
      if (this.isSyncViewBlocked()) return;
      if (this.instance && this.instance.dbId === dbId) {
        this.instUtils.removeInstInArray(this.instance, this.viewHistory);
        if (this.viewHistory.length > 0) {
          // Just show the first instance
          const firstInst = this.viewHistory[0];
          this.changeTable(firstInst);
        }
        else {
          this.showEmpty();
        }
      } else if (this.instance && this.instUtils.isReferrer(dbId, this.instance)) {
        // A referred instance was deleted — reload to reflect the removal
        this.loadInstance(this.instance.dbId, false, false, true);
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      if (this.isSyncViewBlocked()) return;
      if (!this.instance) return;
      if (this.instance.dbId === oldDbId) {
        if (this.commitNewHere) {
          this.commitNewHere = false;
          return;
        }
        this.instUtils.removeInstInArray(this.instance, this.viewHistory);
        this.loadInstance(newDbId, false, false, true);
      } 
      else if (this.instUtils.isReferrer(oldDbId, this.instance)) {
        // A referred new instance was committed — reload so the reference shows the new dbId
        this.loadInstance(this.instance.dbId, false, false, true);
      }
    });
    this.subscriptions.add(subscription);
    // To mark an instance is deleted
    subscription = this.store.select(deleteInstances()).subscribe(deletedInstances => {
      // Keep this in sync unconditionally, even while sync view is blocked (e.g. the initial
      // instance load is still in flight): store selectors replay the current state synchronously
      // to a new subscriber, and if that lands while blocked with nothing dropping in to update
      // it later, isDeleted() would be stuck reading an empty list for this view's whole lifetime.
      //
      // The assignment itself is pushed to the next VM turn (see https://angular.io/errors/NG0100):
      // this emission can arrive synchronously and reentrantly mid change-detection cycle (e.g. a
      // cross-tab update, or a nested dispatch during a commit), and isDeleted()/isChanged() read
      // this.deletedInstances directly in the template, so mutating it synchronously here can flip
      // their value between Angular's check and its dev-mode verification pass within the same tick.
      setTimeout(() => {
        const preSize = this.deletedInstances.length;
        const isIn = this.instance !== undefined
          && this.deletedInstances.map(inst => inst.dbId).includes(this.instance.dbId);
        this.deletedInstances = deletedInstances;

        if (this.isSyncViewBlocked()) return;
        if (!this.instance) return;

        // Check if the current instance is in the deleted instances
        const isCurrentIn = this.deletedInstances.map(inst => inst.dbId).includes(this.instance.dbId);
        if (isIn && !isCurrentIn) {
          return; // The displayed instance is committed
        }
        if ((this.deletedInstances.length - preSize) == -1) {
          // reset a deleted instance from db. since we don't know if the instance has referred
          // this the reset deletion, therefore, we just reload it.
          this.loadInstance(this.instance.dbId, false, false, true);
        }
      });
    });
    this.subscriptions.add(subscription);

    // If a displayed new instance is removed from the staged new list, clear/switch view
    // to avoid trying to reload a deleted local-only instance from the server.
    subscription = this.store.select(newInstances()).subscribe((stagedNewInstances) => {
      if (this.isSyncViewBlocked()) return;
      if (!this.instance) return;

      if (this.instance.dbId < 0) {
        // If the currently displayed new instance was removed, navigate away
        const exists = (stagedNewInstances || []).some(inst => inst.dbId === this.instance!.dbId);
        if (exists) return;

        this.instUtils.removeInstInArray(this.instance, this.viewHistory);
        if (this.viewHistory.length > 0) {
          this.changeTable(this.viewHistory[0]);
        } else {
          this.showEmpty();
        }
      } else {
        // If a new instance referred to by this instance was removed, reload
        // (handles cross-tab removal where deletedDbId$ is not fired)
        const activeNewIds = new Set((stagedNewInstances || []).map(inst => inst.dbId));
        if (this.hasRemovedNewInstanceRef(activeNewIds)) {
          this.loadInstance(this.instance.dbId, false, false, true);
        }
      }
    });
    this.subscriptions.add(subscription);
  }

  private hasRemovedNewInstanceRef(activeNewIds: Set<number>): boolean {
    if (!this.instance?.attributes) return false;
    for (const att of this.instance.attributes.keys()) {
      const attValue = this.instance.attributes.get(att);
      if (!attValue) continue;
      const vals: any[] = Array.isArray(attValue) ? attValue : [attValue];
      for (const v of vals) {
        if (v?.dbId !== undefined && v.dbId < 0 && !activeNewIds.has(v.dbId)
          && this.instUtils.isPermanentlyRemovedNewInstance(v.dbId))
          return true;
      }
    }
    return false;
  }

  isDeleted() {
    if (this.instance) {
      const deletedIds = this.deletedInstances.map(inst => inst.dbId);
      return deletedIds.includes(this.instance.dbId);
    }
    return false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private blockSyncView() {
    this.blockSyncViewCount++;
  }

  private unblockSyncView() {
    if (this.blockSyncViewCount > 0)
      this.blockSyncViewCount--;
  }

  private isSyncViewBlocked(): boolean {
    return this.blockSyncViewCount > 0;
  }

  loadTwoInstances(dbId1: number,
    dbId2: number,
    releaseSyncBlockOnComplete: boolean = false) {
    // avoid to do anything if both dbIds are empty
    // Must always reload due to the combineLatest reaction, ie always loading both instances together
    if (!dbId1 && !dbId2) {
      if (releaseSyncBlockOnComplete)
        this.unblockSyncView();
      return;
    }
    combineLatest([this.dataService.fetchInstance(dbId1).pipe(take(1)), this.dataService.fetchInstance(dbId2).pipe(take(1))])
      .subscribe(([firstInstance, secondInstance]) => {

        // Load the first instance
        combineLatest([this.dataService.handleSchemaClassForInstance(firstInstance).pipe(take(1)),
        this.dataService.handleSchemaClassForInstance(secondInstance).pipe(take(1))
        ]).subscribe(([inst1, inst2]) => {
          firstInstance = inst1;
          secondInstance = inst2;
          // Continue with the rest of the logic below
          this.instance = firstInstance;
          this.dbInstance = secondInstance;
          this.viewHistory.length = 0;
          this.addToViewHistory(firstInstance);
          this.updateTitle(firstInstance);
          this.changeTable(firstInstance);
          this.showReferenceColumn = true;
          this.showProgressSpinner = false;
          if (releaseSyncBlockOnComplete)
            this.unblockSyncView();
        }, () => {
          this.showProgressSpinner = false;
          if (releaseSyncBlockOnComplete)
            this.unblockSyncView();
        });
      }, () => {
        this.showProgressSpinner = false;
        if (releaseSyncBlockOnComplete)
          this.unblockSyncView();
      })
  }

  loadInstance(dbId: number,
    needComparsion: boolean = false,
    resetHistory: boolean = false,
    forceReload: boolean = false,
    resetCache: boolean = false,
    releaseSyncBlockOnComplete: boolean = false) {
    // avoid to do anything if nothing there
    if (!dbId) {
      if (releaseSyncBlockOnComplete)
        this.unblockSyncView();
      return;
    }
    // Avoid reloading if it has been loaded already
    if (dbId && this.instance && !forceReload && dbId === this.instance.dbId && (!needComparsion || (needComparsion && this.dbInstance))) {
      if (releaseSyncBlockOnComplete)
        this.unblockSyncView();
      return;
    }
    // Mark the switch as in flight so that notifications raised while loading (including ones this
    // load raises itself, see loadingDbId) cannot reload the instance being replaced on top of it.
    this.loadingDbId = dbId;
    setTimeout(() => {
      this.showProgressSpinner = true;
      if (resetCache && dbId >= 0) // TODO: Make sure this does not have any side effect.
        this.dataService.removeInstanceInCache(dbId)
      this.dataService.fetchInstance(dbId).subscribe((instance) => {
        if (!instance) {
          this.doneLoading(dbId);
          return; // Don't do anything if there is no instance. Due to the many subscriptions, this may occur. Need more time to figure out why and how to avoid it.
        }
        if (instance.schemaClass)
          // Turn off the comparison first
          this._loadIntance(instance, resetHistory, needComparsion, dbId, releaseSyncBlockOnComplete);
        else {
          this.dataService.handleSchemaClassForInstance(instance).subscribe(inst => {
            this._loadIntance(inst, resetHistory, needComparsion, dbId, releaseSyncBlockOnComplete);
          }, () => {
            this.doneLoading(dbId);
            this.showProgressSpinner = false;
            if (releaseSyncBlockOnComplete)
              this.unblockSyncView();
          })
        }
      }, () => {
        this.doneLoading(dbId);
        this.showProgressSpinner = false;
        if (releaseSyncBlockOnComplete)
          this.unblockSyncView();
      })
    });
  }

  /**
   * Clear the in-flight marker, but only if it still belongs to this load: a newer load started in
   * the meantime owns it and must keep its own protection until it finishes.
   */
  private doneLoading(dbId: number) {
    if (this.loadingDbId === dbId)
      this.loadingDbId = undefined;
  }

  private _loadIntance(instance: Instance,
    resetHistory: boolean,
    needComparsion: boolean,
    dbId: number,
    releaseSyncBlockOnComplete: boolean = false) {
    this.runInstanceViewFilters(instance).subscribe(filteredInstance => {
      // The switch has landed: anything raised from here on applies to the instance now displayed.
      this.doneLoading(dbId);
      // Due to the switch of the bound instance identify, the table will be reloaded automatically.
      // Therefore, nothing needs to be done here.
      if (this.instance === filteredInstance)
        this.instanceTable.updateTableContent(); // Force to reload
      else
        this.instance = filteredInstance;
      // No need to change the table here. When the instance is changed, the table will be updated automatically.
      // this.changeTable(this.instance);
      if (resetHistory)
        this.viewHistory.length = 0;
      this.addToViewHistory(this.instance);
      this.showProgressSpinner = false;
      this.updateTitle(this.instance);
      if (needComparsion) {
        this.dataService.fetchInstanceFromDatabase(dbId, false).subscribe(instance => {
          this.dbInstance = instance;
          this.showReferenceColumn = true;
          if (releaseSyncBlockOnComplete)
            this.unblockSyncView();
        }, () => {
          this.showProgressSpinner = false;
          if (releaseSyncBlockOnComplete)
            this.unblockSyncView();
        });
      } else if (releaseSyncBlockOnComplete) {
        this.unblockSyncView();
      }
    }, () => {
      this.doneLoading(dbId);
      this.showProgressSpinner = false;
      if (releaseSyncBlockOnComplete)
        this.unblockSyncView();
    });
  }

  // Create a list to hold all service instances
  private setUpInstanceViewFilters(): InstanceViewFilter[] {
    return [
      new DeletedInstanceAttributeFilter(this.instUtils, this.store),
      new ReviewStatusUpdateFilter(this.dataService, this.instUtils, this.store, this.reviewStatusCheck),
      new DisplayNameViewFilter(this.dataService, this.instUtils, this.store),
    ];
  }
  // Function to run all registered services
  private runInstanceViewFilters(instance: Instance): Observable<Instance> {
    return this.instanceViewFilters.reduce(
      (acc$, service) => acc$.pipe(concatMap(inst => service.filter(inst))),
      of(instance)
    );
  }

  addToViewHistory(instance: Instance) {
    if (instance === undefined || instance.dbId === 0)
      return;
    // Check if the passed instances has been added already
    // Note: The instance may be reloaded. Therefore, we need to check
    // dbId here
    const index = this.viewHistory.findIndex(tmp => tmp.dbId === instance.dbId);
    if (index > -1) {
      // Revisiting an instance already in the history: drop everything after it so that the
      // bread-crumb ends at the instance being displayed. This is the same truncation the
      // bread-crumb itself does when one of its links is clicked, and it is needed for the
      // cases where the revisit comes from outside the bread-crumb (e.g. re-selecting the
      // instance in the staged list or in the event tree) and would otherwise leave the
      // trail pointing past the displayed instance.
      this.viewHistory.splice(index + 1);
      return;
    }
    // Use the managed, shell instance so that there is no need to reload when it is committed
    // via an reference graph
    this.viewHistory.push(this.instUtils.getShellInstance(instance));
  }

  updateTitle(instance: Instance) {
    if (instance)
      this.title = instance.schemaClass?.name + ": " + instance.displayName + " [" + instance.dbId + "]"
    else
      this.title = ""
  }

  isChanged() {
    // New instance
    if ((this.instance?.dbId ?? -1) < 0)
      return true;
    // updated instance
    if ((this.instance?.modifiedAttributes?.length ?? 0) > 0)
      return true;
    // updated passive attributes
    if ((this.instance?.passiveModifiedAttributes?.length ?? 0) > 0)
      return true;
    return false;
  }

  changeTable(instance: Instance) {
    if (!instance) return;
    // If in comparison mode, the showReferenceColumn will be true and the instance should be loaded.
    if (this.blockRoute || this.showReferenceColumn) {
      this.loadInstance(instance.dbId);
    }
    else {
      let newUrl = this.getCurrentPathRoot() + "/instance/" + instance.dbId.toString();
      this.router.navigate([newUrl], { queryParamsHandling: 'preserve' });
    }
    this.qaReportPassed = undefined;
  }

  private showEmpty() {
    if (this.blockRoute) {
      if (!this.commitNewHere) // Keep the original instance
        this.instance = undefined;
    }
    else {
      let newUrl = this.getCurrentPathRoot();
      this.router.navigate([newUrl]);
    }
  }

  private getCurrentPathRoot() {
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    return currentPathRoot[0];
  }

  addBookmark() {
    if (this.instance)
      this.store.dispatch(BookmarkActions.add_bookmark(this.instUtils.makeShell(this.instance)));
  }

  showReferenceValueColumn() {
    this.showReferenceColumn = !this.showReferenceColumn;
    if (this.blockRoute) {
      // If this is used to switch off the reference column, just return
      if (!this.showReferenceColumn) {
        // Reset this dbInstance to undefined should be enough to refresh 
        // the table
        this.dbInstance = undefined;
        // The following is hard-wired to clear the reference column in the table
        // This should be improved later
        // this.instanceTable.setReferenceInstance(undefined);
        return;
      }
      else {
        this.instUtils.setLastClickedDbIdForComparison(this.instance!.dbId);
        return;
      }
    }
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    let newUrl = currentPathRoot[0] + "/instance/" + this.instance!.dbId.toString();
    // Apparently there is a bug in Angular that confuses the configured router for list_instances
    // and instance view. Therefore, give it something more here.
    if (this.showReferenceColumn)
      this.router.navigate([newUrl, "comparison", this.instance!.dbId.toString()]);
    else
      this.router.navigate([newUrl]);
  }

  isUploadable() {
    if (this.isDeleted())
      return true;
    //TODO: an attribute may add a new value and then delete this new value. Need to have a better
    // control!
    return this.instance ? (this.instance.dbId < 0 || (this.instance.modifiedAttributes && this.instance.modifiedAttributes.length)) : false;
  }

  isComparable() {
    if (this.dbInstance)
      return true; // Make sure the comparison can be turned off
    if (
      this.instance &&
      this.instance.dbId > 0 &&
      (
        (this.instance.modifiedAttributes && this.instance.modifiedAttributes.length > 0) ||
        (this.instance.passiveModifiedAttributes && this.instance.passiveModifiedAttributes.length > 0)
      )
    )
      return true;
    return false;
  }

  upload(): void {
    if (!this.instance) return;
    if (this.isDeleted()) {
      // Commit a deletion
      this.deletionService.processDeletion([this.instance]);
      return;
    }
    if (this.instance.dbId < 0) {
      // Run the pre-commit duplication check for new instances (see shouldCheckForMatches).
      if (!this.dataService.shouldCheckForMatches(this.instance)) {
        this.commitInstance();
        return;
      }
      this.dataService.matchInstances(this.instance).pipe(take(1)).subscribe(matches => {
        if (matches && matches.length > 0) {
          console.debug('[MatchedInstancesDialog] instance-view matches:', matches.length);
          this.matchedInstancesDialogService.openDialog({
            title: 'Matches Found',
            groups: [{ newInstance: this.instance!, matches }]
          }).afterClosed().subscribe(resolutions => {
            this.matchResolutionService.resolve(resolutions).pipe(take(1)).subscribe(toCommit => {
              // toCommit contains this instance only if the user chose "commit anyway".
              if (toCommit.some(inst => inst.dbId === this.instance!.dbId)) {
                this.commitInstance();
              }
            });
          });
          return;
        }
        this.commitInstance();
      });
      return;
    }
    this.commitInstance();
  }

  private commitInstance(): void {
    if (!this.instance) return;
    this.commitWaitDialogRef?.close();
    this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
      disableClose: true,
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Committing Instance',
        message: 'Please wait while this instance is committed.'
      }
    });
    // TODO: Need to present a confirmation dialog after it is done!
    this.dataService.commit(this.instance).pipe(
      take(1),
      finalize(() => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
      })
    ).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst.dbId);
      if (this.instance!.dbId < 0) {
        this.commitNewHere = true;
      }
      this.instUtils.processCommit(this.instance!, storedInst, this.dataService);
      if (this.instance!.dbId < 0) {
        this.instUtils.removeInstInArray(this.instance!, this.viewHistory);
        this.changeTable(storedInst);
      }
      this.commitResultDialogService.openDialog(this.instUtils.buildCommitSummaryResults(this.instance!, storedInst));
    });
  }

  exportEventDocx() {
    if (!this.instance || this.instance.dbId <= 0 || !this.isEventClass())
      return;
    if (this.hasPendingStagedInstances) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'Please commit all staged instances before exporting this event to DOCX.'
        }
      });
      return;
    }
    this.commitWaitDialogRef?.close();
    this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
      disableClose: true,
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Exporting DOCX',
        message: 'Please wait while the server generates the DOCX file.'
      }
    });
    const dbId = this.instance.dbId;
    this.dataService.exportEventDocx(dbId).pipe(
      take(1),
      finalize(() => {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
      })
    ).subscribe({
      next: response => {
        const fileName = this.extractFileName(response.headers.get('content-disposition'))
          || `event_${dbId}.docx`;
        this.downloadBlobAsFile(response.body, fileName);
      },
      error: () => {
        // Error dialog is handled by DataService.
      }
    });
  }

  private extractFileName(contentDisposition: string | null): string | null {
    if (!contentDisposition)
      return null;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1])
      return decodeURIComponent(utf8Match[1]);
    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    return asciiMatch?.[1] ?? null;
  }

  private downloadBlobAsFile(blob: Blob | null, fileName: string) {
    if (!blob)
      return;
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  onQAReportAction() {
    if (this.isUploadable()) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'You may need to commit your changes first for the QA Report',
        }
      });

    }
    else {
      const matDialogRef = this.qaReportDialogService.openDialog(this.instance!);
      matDialogRef.afterClosed().subscribe((result) => {
        // This call site never supplies a pre-built report, so the dialog's
        // "Auto-Fix" close result ('autofix') never applies here -- only the
        // boolean qaReportPassed result is relevant.
        if (typeof result === 'boolean') {
          this.qaReportPassed = result;
        }
      });
    }
  }

  setQAReportToolTip() {
    // Change QA Report toolitp
    if (this.qaReportPassed === undefined && this.isUploadable() === false) { this.qaReportToolTip = "Run QA Report" }
    else if (this.isUploadable()) { this.qaReportToolTip = "You may need to commit your changes first for the QA Report" };
    // else if(this.qaReportPassed === true) {this.qaReportToolTip = "QA Report Passed"};
    // else if(this.qaReportPassed === false) {this.qaReportToolTip = "QA Report Failed"};

    return this.qaReportToolTip;
  }

  delete() {
    this.deletionDialogService.openDialog(this.instance!);
  }

  showReferrers() {
    this.referrersDialogService.openDialog(this.instance!);
  }

  cloneInstance() {
    this.dataService.cloneInstance(this.instance!).subscribe(instance => {
      this.dataService.registerInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(instance)));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId.toString()]);
    });
  }

  /**
   * Change the schema class of the displayed instance. Any concrete class may be chosen; the
   * dialog blocks the change if a referrer's attribute would no longer accept the instance.
   * On confirmation, attributes shared with the new class are preserved, the display name is
   * regenerated, and the same dbId is kept.
   */
  changeSchemaClass() {
    if (!this.instance)
      return;
    const dialogRef = this.dialog.open(ChangeClassDialogComponent, {
      width: '480px',
      data: { instance: this.instance }
    });
    dialogRef.afterClosed().subscribe((newClassName: string | undefined) => {
      if (!newClassName || !this.instance || newClassName === this.instance.schemaClassName)
        return;
      this.dataService.fetchSchemaClass(newClassName).subscribe(newSchemaClass => {
        this.applySchemaClassChange(this.instance!, newSchemaClass);
        // Reload so the table, title and pruned attributes reflect the new class.
        this.loadInstance(this.instance!.dbId, false, false, true);
      });
    });
  }

  private applySchemaClassChange(instance: Instance, newSchemaClass: SchemaClass) {
    const nameGenerator = new InstanceNameGenerator(this.dataService, this.instUtils);
    const apply = (inst: Instance | undefined) => {
      if (!inst)
        return;
      this.instUtils.changeSchemaClass(inst, newSchemaClass);
      // A class change is a structural change; flag it and regenerate the display name,
      // which is derived from the schema class.
      this.instUtils.addToModifiedAttributes('schemaClass', inst);
      inst.isStructureModified = true;
      nameGenerator.updateDisplayName(inst);
    };
    apply(instance.source);
    apply(instance);
    // Make sure the edited object is the one cached, then stage it as an update.
    this.dataService.registerInstance(instance.source ?? instance);
    this.instUtils.registerUpdatedInstance('schemaClass', instance);
  }

  isReferenceGeneProductInstance(): boolean {
    return !!this.instance && this.dataService.isReferenceGeneProductClass(this.instance.schemaClassName);
  }

  /**
   * Create a new EntityWithAccessionedSequence from the displayed ReferenceGeneProduct,
   * copying the shared attributes (referenceEntity, species and names) over. This mirrors
   * the "Create EWAS from RefGeneProduct" action in the Java Curator Tool.
   */
  createEwasFromReferenceGeneProduct() {
    if (!this.instance)
      return;
    const refGeneProduct = this.instance;
    this.dataService.createNewInstance('EntityWithAccessionedSequence').subscribe(ewas => {
      this.instUtils.copyAttributesFromRefGeneProductToEwas(ewas, refGeneProduct);
      // Generate the display name from the freshly copied names.
      new InstanceNameGenerator(this.dataService, this.instUtils).updateDisplayName(ewas);
      // Register the new instance and navigate to it, just like cloneInstance.
      this.dataService.registerInstance(ewas);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(ewas)));
      this.router.navigate(["/schema_view/instance/" + ewas.dbId.toString()]);
    });
  }

  matchNewInstance() {
    if (!this.instance || this.instance.dbId >= 0)
      return;
    this.dataService.matchInstances(this.instance).pipe(take(1)).subscribe(matches => {
      if (!matches || matches.length === 0) {
        this.dialog.open(InfoDialogComponent, {
          data: {
            title: 'Information',
            message: 'No matched instances at the database',
          }
        });
        return;
      }

      const matDialogRef = this.matchInstancesDialogService.openDialog({
        title: 'Matched instances for ' + this.instance!.displayName,
        instances: matches
      });
      matDialogRef.afterClosed().subscribe((result) => {
        if (result)
          this.router.navigate(["/schema_view/instance/" + result.dbId.toString()]);
      });
    });
  }

  /**
   * Merge the displayed instance with another one the curator picks. Either a new instance is
   * created from values chosen out of both, or one instance is merged into the other (its values
   * copied over, its references repointed, and itself marked for deletion). Both outcomes are
   * staged locally; nothing reaches the database until the changes are committed.
   */
  mergeInstances() {
    if (!this.instance)
      return;
    this.mergeInstancesDialogService.merge(this.instance).pipe(take(1)).subscribe(outcome => {
      if (outcome.mode === 'new-instance') {
        this.router.navigate(["/schema_view/instance/" + outcome.instance.dbId.toString()]);
        return;
      }
      // The merge target absorbed the source. Drop the now-deleted source from the bread crumb
      // so it cannot be navigated back to, then show the target. When the target is already the
      // displayed instance, changeTable() would navigate to the URL we are on and show stale
      // values, so force a reload instead.
      if (outcome.sourceDbId !== undefined)
        this.instUtils.removeInstInArray({ dbId: outcome.sourceDbId } as Instance, this.viewHistory);
      if (this.instance?.dbId === outcome.instance.dbId)
        this.loadInstance(outcome.instance.dbId, false, false, true);
      else
        this.changeTable(outcome.instance);
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Merge Complete',
          message: `Merged into ${outcome.instance.displayName} [${outcome.instance.dbId}]. `
            + `${outcome.changedReferrerCount ?? 0} referrer(s) were repointed. `
            + `Commit the staged changes to apply the merge to the database.`
        }
      });
    });
  }

  // TODO: do not hardcode schema view, should not always point back to schema view
  compareInstances() {
    let schemaClass = this.dataService.getSchemaClass(this.instance!.schemaClassName)
    const matDialogRef =
      this.listInstancesDialogService.openDialog({
        schemaClass: schemaClass,
        title: "Compare " + this.instance!.displayName + " to"
      });
    matDialogRef.afterClosed().subscribe((result) => {
      if (result)
        this.router.navigate(["/schema_view/instance/" + this.instance?.dbId.toString() + "/comparison/" + result?.dbId.toString()]);
    });
  }

  isEventClass() {
    return this.dataService.isEventClass(this.instance!.schemaClassName)
  }

  // Open the other view in its own named browser tab so that the current view is kept as is.
  showPathwayDiagram() {
    this.openInNamedWindow("event_view");
  }

  openSchemaView() {
    this.openInNamedWindow("schema_view");
  }

  private openInNamedWindow(view: "event_view" | "schema_view") {
    const url = this.router.serializeUrl(
      this.router.createUrlTree(["/" + view + "/instance/" + this.instance!.dbId])
    );
    // A window having the same name is re-used and re-pointed to the new instance.
    window.open(url, view)?.focus();
  }

  openCuratorGraph() {
    if (!this.instance || this.instance.dbId < 0)
      return;
    const baseUrl = environment.curatorGraphBaseUrl;
    const url = this.isEventClass()
      ? `${baseUrl}/PathwayBrowser/${this.instance!.dbId}`
      : `${baseUrl}/dataSchema/${this.instance!.schemaClassName}/instance/${this.instance!.dbId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
}