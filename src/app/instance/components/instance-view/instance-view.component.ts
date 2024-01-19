import { Component, OnInit, ViewChild } from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceTableComponent } from './instance-table/instance-table.component';
import {CdkDragMove} from "@angular/cdk/drag-drop";
import {DragDropService} from "../../../instance-bookmark/drag-drop.service";

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
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
              private dragDropService: DragDropService) {
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
        if(params['mode']) {
          this.showReferenceColumn = (params['mode'] === 'comparison');
          if(params['dbId2']) {
            let dbId2 = params['dbId2'];
            // Make sure dbId is a number
            dbId2 = parseInt(dbId2);
            this.loadReferenceInstance(dbId2);
          }
          else{
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
      let title = instance.schemaClass?.name + ": " + instance.displayName + "[" + instance.dbId + "]"
      this.title = this.setTitle(title);
    })
  }

  setTitle(title: string): string {
    // if(title.length < 50) return title
    // else return title.substring(0, 50) + "..."
    return title;
  }

  changeTable(instance: Instance) {
    this.dragDropService.resetList();
    this.router.navigate(["/instance_view/" + instance.dbId.toString()], {queryParamsHandling: 'preserve'});
  }

  showReferenceValueColumn() {
    this.showReferenceColumn = !this.showReferenceColumn;
    if(this.showReferenceColumn)
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
    return this.instance ? (this.instance.dbId < 0 || this.instance.modifiedAttributes): false;
  }

  upload(): void {
    console.debug('Upload the instance!');
    // TODO: Need to present a confirmation dialog after it is done!
    this.dataService.commit(this.instance!).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst.dbId);
      this.instance!.modifiedAttributes = undefined;
      // Check if the table content needs to be updated
      let updatedTable: boolean = false;
      if (storedInst.dbId !== this.instance?.dbId) {
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
      // probably it is OK for noew!
      if (updatedTable)
        this.instanceTable.updateTableContent();
      // TODO: Remove the register in update_instance_state!
      // Also update the breakcrunch!
    })
  }

}
