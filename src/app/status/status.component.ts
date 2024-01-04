import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { updatedInstances } from 'src/app/instance/state/instance.selectors';
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';
import { MatListModule } from '@angular/material/list';
import {CdkAccordionModule} from "@angular/cdk/accordion";
import {MainModule} from "../main/main.module";
import {newInstances} from "../instance/state/new-instance/new-instance.selectors";

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule, CdkAccordionModule, UpdatedInstanceListComponent]
})
export class StatusComponent implements OnInit{
  @Input() sidePanelState: number = 0;
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];

  constructor(private store: Store) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.updatedInstances = instances;
    })

    this.store.select(newInstances()).subscribe((instances) => {
      if (instances !== undefined) {
        this.newInstances = instances;
      }
    })
    // for(let instance of this.newInstances) {
    //   this.updatedInstances.push(instance)
    // }
  }

  showUpdated(): void {
    console.debug("Show updated instances: " + this.updatedInstances.length)
    if(this.sidePanelState === 0){
      this.showUpdatedEvent.emit(true);
    }
  }
}
