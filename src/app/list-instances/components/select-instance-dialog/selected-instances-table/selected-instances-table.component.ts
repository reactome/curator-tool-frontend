import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatTableDataSource } from "@angular/material/table";
import { Router } from "@angular/router";
import { Instance } from "../../../../core/models/reactome-instance.model";

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

  displayedColumns: string[] = ['dbId', 'displayName', 'removeInstance'];
  matDataSource = new MatTableDataSource<Instance>();

  constructor(private router: Router) {
  }

  setTable() {
    this.matDataSource.data = this.instances;
    console.log("matDataSource " + this.matDataSource.data);
  }

  removeInstance(instance: Instance) {
    this.removeEvent.emit(instance);
  }

  navigate(dbId: number) {
    // This needs to be update by configuring
    window.open("instance_view/" + dbId + true, '_blank');
  }
}
