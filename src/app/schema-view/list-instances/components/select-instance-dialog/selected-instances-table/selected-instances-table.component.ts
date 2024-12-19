import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatTableDataSource} from "@angular/material/table";
import {Instance} from "../../../../../core/models/reactome-instance.model";
import { ViewOnlyService } from 'src/app/core/services/view-only.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from '../../list-instances-view/table/instance-list-table/instance-list-table.component';

@Component({
  selector: 'app-selected-instances-table',
  templateUrl: './selected-instances-table.component.html',
  styleUrls: ['./selected-instances-table.component.scss']
})
export class SelectedInstancesTableComponent {
  @Input() set dataSource(instances: Instance[]) {
    // instances.forEach(element => {
    //     if (!this.instances.includes(element)) {
    //       this.instances.push(element);
    //     }
    // });
    this.instances = instances;
    this.setTable();
  }

  @Output() removeEvent = new EventEmitter<Instance>();
  instances: Instance[] = [];
  matDataSource = new MatTableDataSource<Instance>();
  isSelection: boolean = true;
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.CLOSE];

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
        window.open(`schema_view/instance/${dbId}`, '_blank');
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
