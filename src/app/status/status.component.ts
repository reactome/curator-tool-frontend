import { CdkAccordionModule } from "@angular/cdk/accordion";
import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { AuthenticateService } from "../core/services/authenticate.service";
import { DataService } from "../core/services/data.service";
import { InstanceBookmarkModule } from "../schema-view/instance-bookmark/instance-bookmark.module";
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
    imports: [MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule, CdkAccordionModule, UpdatedInstanceListComponent, InstanceBookmarkModule, MatIconModule, MatTooltipModule]
})
export class StatusComponent implements OnInit {
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  bookmarkList: Instance[] = [];

  constructor(private store: Store,
              private authenticateService: AuthenticateService,
              private dataService: DataService,
              private router: Router) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.updatedInstances = instances;
    });

    this.store.select(newInstances()).subscribe((instances) => {
      if (instances !== undefined) {
        this.newInstances = instances;
      }
    });

    this.store.select(deleteInstances()).subscribe((instances) => {
      if (instances !== undefined) {
        this.deletedInstances = instances;
      }
    });
  }

  // Calling ngOnDestroy is not reliable: https://blog.devgenius.io/where-ngondestroy-fails-you-54a8c2eca0e0.
  @HostListener('window:beforeunload', ['$event'])
  persistInstances(): void {
    console.debug('Calling persist instance before window closing...');
    const instances = [...this.newInstances, ...this.updatedInstances];
    if (instances.length == 0) {
      this.dataService.deletePersistedInstances('test').subscribe(() => {
        console.debug('Delete any persisted instance at the server.');
      });
      return; // Do nothing
    }
    this.dataService.persistInstances(instances, 'test').subscribe(() => {
      console.debug('New and updated instances have been persisted at the server.');
    });
  }

  showUpdated(): void {
    this.showUpdatedEvent.emit(true);
  }

  logout() {
    this.router.navigate(["/login"]);
    this.authenticateService.logout();
  }
}
