import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { DragDropService } from "../../../instance-bookmark/drag-drop.service";
import { InstanceTableComponent } from './instance-table/instance-table.component';
import { QAReportDialogService } from '../qa-report-dialog/qa-report-dialog.service';
import { Store } from '@ngrx/store';
import { InstanceActions, NewInstanceActions } from '../../state/instance.actions';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss'],
})

export class InstanceViewComponent implements OnInit {
  // Used to force the update of table content
  @ViewChild(InstanceTableComponent) instanceTable!: InstanceTableComponent;
  viewHistory: Instance[] = [];
  dbIds: any = [];
  // instance to be displayed
  instance: Instance | undefined;
  // Control if the instance is loading
  showProgressSpinner: boolean = false;
  showReferenceColumn: boolean = false;
  dbInstance: Instance | undefined;
  title: string = '';

  constructor(private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private dragDropService: DragDropService,
    private store: Store,
    private qaReportDialogService: QAReportDialogService) {
  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    // Handle the loading of instance directly here without using ngrx's effect, which is just
    // too complicated and not necessary here.
    this.route.params.subscribe((params) => {
      console.log("params", params)
      if (params['dbId']) {
        let dbId = params['dbId'];
        // Make sure dbId is a number
        dbId = parseInt(dbId);
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
  }

  private loadInstance(dbId: number) {
    this.showProgressSpinner = true;
    this.dataService.fetchInstance(dbId).subscribe((instance) => {
      this.instance = instance;
      if (this.instance.dbId !== 0 && !this.dbIds.includes(this.instance.dbId))
        this.viewHistory.push(this.instance);
      this.dbIds.push(this.instance.dbId)
      this.showProgressSpinner = false;
      this.updateTitle(instance);
    })
  }

  updateTitle(instance: Instance) {
    if (instance)
      this.title = instance.schemaClass?.name + ": " + instance.displayName + "[" + instance.dbId + "]"
    else
      this.title = ""
  }

  changeTable(instance: Instance) {
    this.dragDropService.resetList();
    this.router.navigate(["/schema_view/instance/" + instance.dbId.toString()], { queryParamsHandling: 'preserve' });
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
    console.debug('Upload the instance!');
    // TODO: Need to present a confirmation dialog after it is done!
    this.dataService.commit(this.instance!).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst.dbId);
      this.instance!.modifiedAttributes = undefined;
      // Check if the table content needs to be updated
      let updatedTable: boolean = false;
      let oldDbId = undefined;
      if (storedInst.dbId !== this.instance?.dbId) {
        oldDbId = this.instance!.dbId; // keep it for remove in the registration
        this.instance!.dbId = storedInst.dbId;
        if (this.instance!.attributes)
          this.instance!.attributes.set('dbId', storedInst.dbId);
        updatedTable = true;
      }
      if (storedInst.displayName !== this.instance?.displayName) {
        this.instance!.displayName = storedInst.displayName;
        if (this.instance!.attributes)
          this.instance!.attributes.set('displayName', storedInst.displayName);
        updatedTable = true;
      }
      // Most likely this is not a good idea. However, since this view is tied to the table,
      // probably it is OK for now!
      if (updatedTable)
        this.instanceTable.updateTableContent();
      if (oldDbId) {
        // Just need a simple clone
        let oldInst : Instance = {
          dbId: oldDbId,
          displayName: this.instance?.displayName,
          schemaClassName: this.instance!.schemaClassName
        }
        this.store.dispatch(NewInstanceActions.remove_new_instance(oldInst));
      }
      else
        this.store.dispatch(InstanceActions.remove_updated_instance(this.instance!));
      // Also update the breakcrunch!
    })
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

}
