import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatTableDataSource} from "@angular/material/table";
import {Instance} from "../../../../../core/models/reactome-instance.model";
import { ViewOnlyService } from 'src/app/core/services/view-only.service';

@Component({
  selector: 'app-selected-instances-table',
  templateUrl: './selected-instances-table.component.html',
  styleUrls: ['./selected-instances-table.component.scss']
})
export class SelectedInstancesTableComponent {
  @Input() set dataSource(instances: Instance[]) {
    this.instances = instances;
    this.setTable();
  }

  @Output() removeEvent = new EventEmitter<Instance>();
  instances: Instance[] = [];
  matDataSource = new MatTableDataSource<Instance>();
  isSelection: boolean = true;
  actionButtons: string[] = ["launch", "close"];

  setTable() {
    this.matDataSource.data = this.instances;
  }

  removeInstance(instance: Instance) {
    this.removeEvent.emit(instance);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {

      case "launch": {
        const dbId = actionButton.instance.dbId;
        window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
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
