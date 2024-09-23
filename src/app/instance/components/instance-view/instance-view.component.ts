import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import { DragDropService } from "../../../schema-view/instance-bookmark/drag-drop.service";
import { UpdateInstanceActions, NewInstanceActions } from '../../state/instance.actions';
import { DeletionDialogService } from "../deletion-dialog/deletion-dialog.service";
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { ReferrersDialogService } from "../referrers-dialog/referrers-dialog.service";
import { InstanceTableComponent } from './instance-table/instance-table.component';
import { InstanceUtilities } from 'src/app/core/services/instance.service';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss'],
})

export class InstanceViewComponent implements OnInit {
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
  // Control if we need to track the loading history
  @Input() needHistory: boolean = true;
  // Control if the route should be used for the links in the table, bookmarks, etc
  @Input() blockRoute: boolean = false;

  // Flag to avoid update itself
  private commitNewHere: boolean = false;

  constructor(private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private dragDropService: DragDropService,
    private store: Store,
    private qaReportDialogService: QAReportDialogService,
    private referrersDialogService: ReferrersDialogService,
    private instUtils: InstanceUtilities,
    private deletionDialogService: DeletionDialogService) {
  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    // Handle the loading of instance directly here without using ngrx's effect, which is just
    // too complicated and not necessary here.
    this.route.params.subscribe((params) => {
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
    this.instUtils.refreshViewDbId$.subscribe(dbId => {
      if (this.instance && this.instance.dbId === dbId) {
        this.loadInstance(dbId, false, false, true);
      }
    });
    this.instUtils.deletedDbId$.subscribe(dbId => {
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
    this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      if (!this.instance || this.instance.dbId !== oldDbId)
        return;
      if (this.commitNewHere) {
        this.commitNewHere = false;
        return;
      }
      this.instUtils.removeInstInArray(this.instance, this.viewHistory);
      this.dataService.fetchInstance(newDbId).subscribe(inst => this.changeTable(inst));
    });
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
    this.viewHistory.push(instance);
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
    if (this.blockRoute) {
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
    // TODO: Need to present a confirmation dialog after it is done!
    this.dataService.commit(this.instance).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst.dbId);
      if (this.instance!.dbId >= 0)
        this.store.dispatch(UpdateInstanceActions.remove_updated_instance(this.instance!));
      else {
        this.store.dispatch(NewInstanceActions.remove_new_instance(this.instance!));
        this.commitNewHere = true;
        this.store.dispatch(NewInstanceActions.commit_new_instance({oldDbId: this.instance!.dbId, newDbId: storedInst.dbId}));
        this.instUtils.removeInstInArray(this.instance!, this.viewHistory);
      }
      this.changeTable(storedInst);
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
}
