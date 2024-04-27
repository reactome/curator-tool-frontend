import {Component, EventEmitter, Input, OnInit, Output, OnChanges} from '@angular/core';
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
  @Output() generatePlotFromEventTreeSel = new EventEmitter<string>();
  @Input() dbIdAndClassName: string = "";
  @Input() dbIdAndClassNameFromPlot: string = "";
  public dbIdAndClassNameFromPlotToEventTree: string = "";

  data: Instance[] = [];
  constructor(private store: Store) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.data = instances;
    })
  }

  ngOnChanges() {
    if (this.dbIdAndClassNameFromPlot) {
        this.dbIdAndClassNameFromPlotToEventTree = this.dbIdAndClassNameFromPlot;
    }
  }

  updateTabIndex() {
    let showList = this.showUpdatedList !== 0;
    this.updateTabIndexEvent.emit(showList);
  }

  generatePlotToMainEvent(param: string) {
    this.generatePlotFromEventTreeSel.emit(param);
  }
}
