import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Instance} from "../../../core/models/reactome-instance.model";
import {Store} from "@ngrx/store";
import { updatedInstances } from 'src/app/instance/state/instance.selectors';

@Component({
  selector: 'app-side-navigation',
  templateUrl: './side-navigation.component.html',
  styleUrls: ['./side-navigation.component.scss']
})
export class SideNavigationComponent implements OnInit {
  @Input() showUpdatedList: number = 0;
  @Output() updateTabIndexEvent = new EventEmitter<number>();
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
    this.updateTabIndexEvent.emit(this.showUpdatedList);
  }
}
