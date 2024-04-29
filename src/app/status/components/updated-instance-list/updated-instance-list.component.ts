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
  actionButtons: string[] = ["compare"];
  isSelection: boolean = false;
  newInstances: Instance[] = [];
  updatedInstances: Instance[] = [];
  showHeader: boolean = false;
  newInstancesActionButtons: string[] = ["launch"];

  constructor(private router: Router, private store: Store, private route: ActivatedRoute) {
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
    }
  }

  launchNewInstance(instance: Instance) {
    this.router.navigate(["/instance_view/", instance.dbId]);
  }
}
