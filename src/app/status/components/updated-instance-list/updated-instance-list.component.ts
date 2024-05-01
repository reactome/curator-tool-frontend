import {Component, Input, OnInit} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatTableModule} from '@angular/material/table';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {Router, ActivatedRoute} from "@angular/router";
import {ListInstancesModule} from "../../../schema-view/list-instances/list-instances.module";
import {Store} from "@ngrx/store";
import { updatedInstances } from 'src/app/instance/state/instance.selectors';
import { newInstances } from 'src/app/instance/state/instance.selectors';
import { InstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from 'src/app/core/services/data.service';


@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule, ListInstancesModule],
})
export class UpdatedInstanceListComponent implements OnInit{
  // instances to be committed
  toBeUploaded: Instance[] = [];
  actionButtons: string[] = ["compare", "undo"];
  isSelection: boolean = false;
  newInstances: Instance[] = [];
  updatedInstances: Instance[] = [];
  showHeader: boolean = false;
  newInstancesActionButtons: string[] = ["launch", "delete"];

  constructor(private router: Router,
              private route: ActivatedRoute,
              private store: Store,
              private dataService: DataService) {
  }

  ngOnInit(): void {
    this.store.select(newInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.newInstances = instances;
    })
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.updatedInstances = instances;
    })
  }

  compareWithDB(instance: Instance) {
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
                                                   .reduce((acc, val) => acc.concat(val), [])
                                                   .map(urlSegment => urlSegment.path);
    let newUrl =  currentPathRoot[0] + "/instance/" + instance.dbId.toString();
    this.router.navigate([newUrl, "comparison"]);
  }

  onSelectionChange(instance: Instance, event: MatCheckboxChange) {
    let index = this.toBeUploaded.indexOf(instance);
    if (event.checked) {
      if (index < 0)
        this.toBeUploaded.push(instance);
    } else {
      if (index > -1)
        this.toBeUploaded.splice(index, 1);
    }
    console.debug('Instances to be uploaded: ' + this.toBeUploaded.length);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      case "compare": {
        this.compareWithDB(actionButton.instance)
        break;
      }

      case "launch": {
        this.launchNewInstance(actionButton.instance)
        break;
      }

      case "delete": {
        this.deleteNewInstance(actionButton.instance);
        break;
      }

      case "undo": {
        this.resetUpdatedInstance(actionButton.instance);
      }
    }
  }

  //TODO: Should try to use effects to handle this to avoid
  // referring DataService, which has been referred too many
  // places now!
  private resetUpdatedInstance(instance: Instance) {
    console.debug('Reset updated instance: ', instance);
    this.dataService.removeInstanceInCache(instance);
    this.store.dispatch(InstanceActions.remove_updated_instance(instance));
  }

  private deleteNewInstance(instance: Instance) {
    this.store.dispatch(NewInstanceActions.remove_new_instance(instance));
    // TODO: The following cleaning up needs to be done:
    // 1). Remove the reference to this instance in any local changed instances
    // 2). Remove it from the bookmarks in case it is registered there.
    // To implement the above, consider to use ngrx's effects and add a new action.
  }

  launchNewInstance(instance: Instance) {
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
                                                     .reduce((acc, val) => acc.concat(val), [])
                                                     .map(urlSegment => urlSegment.path);
      let newUrl =  currentPathRoot[0] + "/instance/" + instance.dbId.toString();

    this.router.navigate([newUrl]);
  }
}
