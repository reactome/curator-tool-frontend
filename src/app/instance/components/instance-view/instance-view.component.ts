import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Store} from "@ngrx/store";
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {InstanceActions} from "../../state/instance.actions";
import {selectViewInstance} from '../../state/instance.selectors';
import {DataService} from 'src/app/core/services/data.service';

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
    if(this.showReferenceColumn) this.getDbInstance(this.instance!.dbId);
    else this.dbInstance = undefined;
  }

  private getDbInstance(dbId: number) {
    this.dataService.fetchInstanceFromDatabase(dbId, false).subscribe(
      dbInstance => this.dbInstance = dbInstance);
  }

  upload() {
    console.debug('Upload the instance!');
  }

}
