import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {Instance} from "../../../../core/models/reactome-instance.model";
import {MatTableDataSource} from "@angular/material/table";

@Component({
  selector: 'app-selected-instances-table',
  templateUrl: './selected-instances-table.component.html',
  styleUrls: ['./selected-instances-table.component.scss']
})
export class SelectedInstancesTableComponent {
  @Input() set setDataSource(instances: Instance[]) {
    this.instances = instances;
    this.setTable();
    console.log("instances " + instances)
  }

  instances: Instance[] = [];

  displayedColumns: string[] = ['dbId', 'displayName'];
  matDataSource = new MatTableDataSource<Instance>();

  constructor() {
  }

  setTable() {
    this.matDataSource.data = this.instances;
    console.log("matDataSource " + this.matDataSource.data);
  }
}
