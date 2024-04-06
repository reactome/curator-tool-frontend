import {Component, Input, OnInit} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatTableModule} from '@angular/material/table';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {Router} from "@angular/router";
import {ListInstancesModule} from "../../../schema-view/list-instances/list-instances.module";
import {Store} from "@ngrx/store";
import {newInstances, newInstanceState} from "../../../schema-view/instance/state/new-instance/new-instance.selectors";

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule, ListInstancesModule],
})
export class UpdatedInstanceListComponent implements OnInit{
  @Input() data: Instance[] = [];
  // instances to be committed
  toBeUploaded: Instance[] = [];
  actionButtons: string[] = ["compare"];
  isSelection: boolean = false;
  newInstances: Instance[] = [];
  showHeader: boolean = false;
  newInstancesActionButtons: string[] = ["launch"];

  constructor(private router: Router, private store: Store) {
    this.toBeUploaded = [...this.data];
  }

  ngOnInit(): void {
    this.store.select(newInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.newInstances = instances;
    })
  }

  compareWithDB(instance: Instance) {
    this.router.navigate(["/schema_view/instance/", instance.dbId, "comparison"]);
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
