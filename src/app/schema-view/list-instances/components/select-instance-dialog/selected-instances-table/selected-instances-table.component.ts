import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatTableDataSource} from "@angular/material/table";
import {Instance} from "../../../../../core/models/reactome-instance.model";

@Component({
  selector: 'app-selected-instances-table',
  templateUrl: './selected-instances-table.component.html',
  styleUrls: ['./selected-instances-table.component.scss']
})
export class SelectedInstancesTableComponent {
  @Input() set dataSource(instances: Instance[]) {
    this.instances = instances;
    this.setTable();
    console.log("instances " + instances)
  }

  @Output() removeEvent = new EventEmitter<Instance>();
  instances: Instance[] = [];
  matDataSource = new MatTableDataSource<Instance>();
  isSelection: boolean = true;
  actionButtons: string[] = ["launch", "close"];

  setTable() {
    this.matDataSource.data = this.instances;
    console.log("matDataSource " + this.matDataSource.data);
  }

  removeInstance(instance: Instance) {
    this.removeEvent.emit(instance);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      case "launch": {
        this.navigate(actionButton.instance);
        break;
      }

      case "close": {
        this.removeInstance(actionButton.instance);
        break;
      }
    }
  }

  navigate(instance: Instance) {
    // This needs to be update by configuring
    window.open("instance_view/" + instance.dbId + true, '_blank');
  }
}
