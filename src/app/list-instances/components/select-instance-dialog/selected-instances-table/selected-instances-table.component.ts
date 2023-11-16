import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Instance} from "../../../../core/models/reactome-instance.model";
import {MatTableDataSource} from "@angular/material/table";

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

  constructor() {
  }

  setTable() {
    this.matDataSource.data = this.instances;
    console.log("matDataSource " + this.matDataSource.data);
  }

  removeInstance(instance: Instance) {
    this.removeEvent.emit(instance);
  }
}
