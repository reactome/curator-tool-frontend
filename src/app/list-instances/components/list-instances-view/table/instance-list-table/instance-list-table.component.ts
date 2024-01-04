import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Instance} from "../../../../../core/models/reactome-instance.model";
import {DataService} from "../../../../../core/services/data.service";

@Component({
  selector: 'app-instance-list-table',
  templateUrl: './instance-list-table.component.html',
  styleUrls: ['./instance-list-table.component.scss']
})
export class InstanceListTableComponent {
  @Input() dataSource: Instance[] = [];
  @Input() actionButtons: string[] = [];
  @Input() isSelection: boolean = false;
  @Input() showHeader: boolean = true;
  displayedColumns: string[] = ['dbId', 'displayName', 'actionButtons'];
  @Output() selectionEvent = new EventEmitter<Instance>();
  @Output() actionEvent = new EventEmitter<{instance: Instance, action: string}>();
  selected: number = 0;
  displayName: string | undefined = '';

  click(instance: Instance, action: string) {
    let actionButton  = {instance, action};
    this.actionEvent.emit(actionButton);
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.selectionEvent.emit(row)
  }

  protected readonly DataService = DataService;
}
