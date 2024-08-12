import {Component, EventEmitter, Input, OnInit, Output, OnDestroy} from '@angular/core';
import {Instance} from "../../../../core/models/reactome-instance.model";
import {Store} from "@ngrx/store";
import { updatedInstances } from 'src/app/instance/state/instance.selectors';

@Component({
  selector: 'app-side-navigation',
  templateUrl: './side-navigation.component.html',
  styleUrls: ['./side-navigation.component.scss']
})
export class EventSideNavigationComponent implements OnInit {
  @Input() showUpdatedList: number = 0;
  @Output() updateTabIndexEvent = new EventEmitter<boolean>();
  // Passover
  @Output() addEventToDiagram = new EventEmitter<Instance>();
  @Output() eventClicked = new EventEmitter<number>();

  data: Instance[] = [];
  constructor(private store: Store) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.data = instances;
    })
  }

  updateTabIndex() {
    let showList = this.showUpdatedList !== 0;
    this.updateTabIndexEvent.emit(showList);
  }

  addEventToDiagramAction(instance: Instance) {
    this.addEventToDiagram.emit(instance);
  }

  eventClickedAction(dbId: any) {
    this.eventClicked.emit(dbId);
  }
}
