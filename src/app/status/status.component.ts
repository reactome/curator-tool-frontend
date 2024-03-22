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
import {newInstances} from "../instance/state/new-instance/new-instance.selectors";
import {InstanceBookmarkModule} from "../instance-bookmark/instance-bookmark.module";
import {bookmarkedInstances, bookmarkState} from "../instance-bookmark/state/bookmark.selectors";
import {MatIconModule} from "@angular/material/icon";
import {MatTooltipModule} from "@angular/material/tooltip";
import {AuthenticateService} from "../core/services/authenticate.service";

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
    imports: [MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule, CdkAccordionModule, UpdatedInstanceListComponent, InstanceBookmarkModule, MatIconModule, MatTooltipModule]
})
export class StatusComponent implements OnInit{
  @Input() sidePanelState: number = 0;
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];
  bookmarkList: Instance[] = [];

  constructor(private store: Store, private authenticateService: AuthenticateService) {
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
  }

  showUpdated(): void {
    console.debug("Show updated instances: " + this.updatedInstances.length)
    if(this.sidePanelState === 0){
      this.showUpdatedEvent.emit(true);
    }
  }

  logout() {
    this.authenticateService.logout();
  }
}
