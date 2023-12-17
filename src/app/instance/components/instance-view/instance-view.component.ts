import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent implements OnInit {
  viewHistory: Instance[] = [];
  dbIds: any = [];
  // instance to be displayed
  instance: Instance | undefined;
  // Control if the instance is loading
  showProgressSpinner: boolean = false;
  showReferenceColumn: boolean = false;
  dbInstance: Instance | undefined;

  constructor(private router: Router,
              private route: ActivatedRoute,
              private dataService: DataService) {
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
        this.loadInstance(dbId);
        console.log("mode", params)
      }
      if(params['mode']) {
        console.log("comparison" + params['comparison'])
        this.showReferenceColumn = params['comparison'];
      }
      if(params['dbId2']) {
        let dbId = params['dbId2'];
        // Make sure dbId is a number
        dbId = parseInt(dbId);
        this.getDbInstance(dbId);
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
    })
  }

  changeTable(instance: Instance) {
    this.router.navigate(["/instance_view/" + instance.dbId.toString()], {queryParamsHandling: 'preserve'});
  }

  showReferenceValueColumn() {
    this.showReferenceColumn = !this.showReferenceColumn;
    if(this.showReferenceColumn) 
      this.getDbInstance(this.instance!.dbId);
    else 
      this.dbInstance = undefined;
  }

  private getDbInstance(dbId: number) {
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
    this.dataService.commit(this.instance!).subscribe(dbId => {
      console.debug('Returned dbId: ' + dbId);
      // TODO: This may be overkill. See is there is a more efficient way.
      this.loadInstance(dbId);
      // TODO: Remove the register in update_instance_state!
      // Also update the breakcrunch!
    })
  }

}
