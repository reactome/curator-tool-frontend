import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import { DragDropService } from "../../../schema-view/instance-bookmark/drag-drop.service";
import { UpdateInstanceActions, NewInstanceActions, DeleteInstanceActions } from '../../state/instance.actions';
import { DeletionDialogService } from "../deletion-dialog/deletion-dialog.service";
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { ReferrersDialogService } from "../referrers-dialog/referrers-dialog.service";
import { InstanceTableComponent } from './instance-table/instance-table.component';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Subscription, take } from 'rxjs';
import { ListInstancesDialogService } from 'src/app/schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service';
import { deleteInstances } from '../../state/instance.selectors';

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
  showReferenceColumn: boolean = false;
  dbInstance: Instance | undefined;
  title: string = '';
  showSecondaryButtons: boolean = false;
  compareInstanceDialogResult$: number = 0;
  
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

  constructor(private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private dragDropService: DragDropService,
    private store: Store,
    private qaReportDialogService: QAReportDialogService,
    private referrersDialogService: ReferrersDialogService,
    private instUtils: InstanceUtilities,
    private deletionDialogService: DeletionDialogService,
    private listInstancesDialogService: ListInstancesDialogService) {
  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    // Handle the loading of instance directly here without using ngrx's effect, which is just
    // too complicated and not necessary here.
    let subscription = this.route.params.subscribe((params) => {
      if (params['dbId']) {
        let dbId = params['dbId'];
        // Make sure dbId is a number
        dbId = parseInt(dbId);
        // This is the case for the default event_view landing page: event_view/instance/0
        if (dbId === 0) {
          return;
        }
        this.loadInstance(dbId);
        // May want to change to case statement if multiple modes
        if (params['mode']) {
          this.showReferenceColumn = (params['mode'] === 'comparison');
          if (params['dbId2']) {
            let dbId2 = params['dbId2']; 
            // Make sure dbId is a number
            dbId2 = parseInt(dbId2);
            this.loadReferenceInstance(dbId2);
          }
          else {
            this.loadReferenceInstance(dbId);
          }
        }
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.refreshViewDbId$.subscribe(dbId => {
      if (this.instance && this.instance.dbId === dbId) {
        this.loadInstance(dbId, false, false, true);
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.resetInst$.subscribe(data => {
      // These two cases work for reset an updated instances
      if (this.instance && this.instance.dbId === data.dbId) {
        this.loadInstance(data.dbId, false, false, true);
      }
      else if (this.instUtils.isReferrer(data.dbId, this.instance!))
        this.loadInstance(this.instance!.dbId, false, false, true);
    });
    this.subscriptions.add(subscription);
    // In case the deleted instance is referred by the current instance
    subscription = this.instUtils.markDeletionDbId$.subscribe(dbId => {
      if (this.instance && this.instUtils.isReferrer(dbId, this.instance)) {
        this.loadInstance(this.instance.dbId, false, false, true);
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.deletedDbId$.subscribe(dbId => {
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
      }
    });
    this.subscriptions.add(subscription);
    subscription = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      if (!this.instance || this.instance.dbId !== oldDbId)
        return;
      if (this.commitNewHere) {
        this.commitNewHere = false;
        return;
      }
      this.instUtils.removeInstInArray(this.instance, this.viewHistory);
      this.dataService.fetchInstance(newDbId).subscribe(inst => this.changeTable(inst));
    });
    this.subscriptions.add(subscription);
    // To mark an instance is deleted
    subscription = this.store.select(deleteInstances()).subscribe(deletedInstances => {
      if (!this.instance)
        return;
      // Check if the current instance is in the deleted instances
      const isIn = this.deletedInstances.map(inst => inst.dbId).includes(this.instance.dbId);
      const preSize = this.deletedInstances.length;
      this.deletedInstances = deletedInstances;  
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
    this.subscriptions.add(subscription);
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

  loadInstance(dbId: number,
    needComparsion: boolean = false,
    resetHistory: boolean = false,
    forceReload: boolean = false) {
    // avoid to do anything if nothing there
    if (!dbId) return;
    // Avoid reloading if it has been loaded already
    if (dbId && this.instance && !forceReload && dbId === this.instance.dbId)
      return;
    // if (!this.instance) {
    //   this.router.navigate(["/schema_view"])
    // }
    setTimeout(() => {
      // Wrap them together to avoid NG0100 error
      this.showProgressSpinner = true;
      if (forceReload) // TODO: Make sure this does not have any side effect.
        this.dataService.removeInstanceInCache(dbId)
      this.dataService.fetchInstance(dbId).subscribe((instance) => {
        if (instance.schemaClass)
          // Turn off the comparison first
          this._loadIntance(instance, resetHistory, needComparsion, dbId);
        else {
          this.dataService.handleSchemaClassForInstance(instance).subscribe(inst => {
            this._loadIntance(inst, resetHistory, needComparsion, dbId);
          })
        }
      })
    });
  }

  private _loadIntance(instance: Instance, resetHistory: boolean, needComparsion: boolean, dbId: number) {
    this.dbInstance = undefined;
    this.instance = instance;
    this.changeTable(instance);
    if (resetHistory)
      this.viewHistory.length = 0;
    this.addToViewHistory(instance);
    this.showProgressSpinner = false;
    this.updateTitle(instance);
    if (needComparsion) {
      this.dataService.fetchInstanceFromDatabase(dbId, false).subscribe(instance => {
        this.dbInstance = instance;
      });
    }
  }

  addToViewHistory(instance: Instance) {
    if (instance === undefined || instance.dbId === 0)
      return;
    // Check if the passed instances has been added already
    // Note: The instance may be reloaded. Therefore, we need to check
    // dbId here
    for (let tmp of this.viewHistory) {
      if (tmp.dbId === instance.dbId)
        return; // Nothing to do
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
    return false;
  }

  changeTable(instance: Instance) {
    this.dragDropService.resetList();
    // If in comparison mode, the showReferenceColumn will be true and the instance should be loaded.
    if (this.blockRoute || this.showReferenceColumn) {
      this.loadInstance(instance.dbId);
    }
    else {
      let newUrl = this.getCurrentPathRoot() + "/instance/" + instance.dbId.toString();
      this.router.navigate([newUrl], { queryParamsHandling: 'preserve' });
    }
  }

  private showEmpty() {
    if (this.blockRoute) {
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
      this.store.dispatch(BookmarkActions.add_bookmark(this.instance));
  }

  showReferenceValueColumn() {
    this.showReferenceColumn = !this.showReferenceColumn;
    if (this.showReferenceColumn)
      this.loadReferenceInstance(this.instance!.dbId);
    else
      this.dbInstance = undefined;
  }

  //TODO: Consider showing the different attributes as the default.
  private loadReferenceInstance(dbId: number) {
    this.dataService.fetchInstanceFromDatabase(dbId, false).subscribe(
      dbInstance => this.dbInstance = dbInstance);
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
    if (this.instance && this.instance.dbId > 0 &&
      this.instance.modifiedAttributes &&
      this.instance.modifiedAttributes.length)
      return true;
    return false;
  }

  upload(): void {
    if (!this.instance) return;
    if (this.isDeleted()) {
      // Commit a deletion
      this.dataService.delete(this.instance).pipe(take(1)).subscribe(rtn => {
        // Have to subscript it. Otherwise, the http call will not be fired
        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(this.instance!));
        this.instUtils.setDeletedDbId(this.instance!.dbId);
        this.dataService.flagSchemaTreeForReload();
      });
      return;
    }
    // TODO: Need to present a confirmation dialog after it is done!
    this.dataService.commit(this.instance).pipe(take(1)).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst.dbId);
      if (this.instance!.dbId < 0) {
        this.commitNewHere = true;
      }
      this.instUtils.processCommit(this.instance!, storedInst, this.dataService);
      if (this.instance!.dbId < 0) {
        this.instUtils.removeInstInArray(this.instance!, this.viewHistory);
        this.changeTable(storedInst);
      }
    });
  }

  onQAReportAction(reportName: string) {
    // console.debug(" ** onQAReportAction: ", reportName, this.instance!.qaIssues);
    let qaReportData = this.instance!.qaIssues!.get(reportName)!;
    const matDialogRef = this.qaReportDialogService.openDialog(reportName, qaReportData);
    //       matDialogRef.afterClosed().subscribe(result => {
    //         if (result !== undefined) {
    //           console.debug("QA report dialog closed", result);
    //         }
    //       });
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

  compareInstances(){
    const matDialogRef =
    this.listInstancesDialogService.openDialog({schemaClassName: this.instance!.schemaClassName, 
      title: "Compare " + this.instance!.displayName + " to"});
    matDialogRef.afterClosed().subscribe((result) => {
      if(result)
        this.router.navigate(["/schema_view/instance/" + this.instance?.dbId.toString() + "/comparison/" + result?.dbId.toString()]);
    });
  }
}
