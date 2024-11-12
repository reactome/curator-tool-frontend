import { CdkAccordionModule } from "@angular/cdk/accordion";
import { Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from '@angular/core';
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
import { bookmarkedInstances } from "../schema-view/instance-bookmark/state/bookmark.selectors";
import { UpdatedInstanceListComponent } from './components/updated-instance-list/updated-instance-list.component';
import { NgIf } from "@angular/common";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Observable } from "rxjs";

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
    imports: [NgIf, MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule, CdkAccordionModule, UpdatedInstanceListComponent, InstanceBookmarkModule, MatIconModule, MatTooltipModule]
})
export class StatusComponent implements OnInit {
  @Input() hideInstanceStatus: boolean = false;
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  error = this.dataService.errorMessage$;

  constructor(private store: Store,
              private authenticateService: AuthenticateService,
              private dataService: DataService,
              private router: Router) {
                this.error.subscribe(err => {this.openSnackBar(err.message, "close")})
  }

  private _snackBar = inject(MatSnackBar);

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action);
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
    const instances = [...this.newInstances, ...this.updatedInstances, ...this.deletedInstances];
    if (instances.length == 0) {
      this.dataService.deletePersistedInstances('test').subscribe(() => {
        console.debug('Delete any persisted instance at the server.');
      });
      // Clean up localStorage before returning
      localStorage.clear();
      return; // Do nothing
    }
    // Technically it would be nicer to have a cnetral place to do this.
    // Put them here for the time being for convenience since we have most of 
    // objects here already.
    this.store.select(bookmarkedInstances()).subscribe(bookmarks => {
      localStorage.clear(); 
      // To be persist
      const userInstances = {
        newInstances: this.newInstances,
        updatedInstances: this.updatedInstances,
        deletedInstances: this.deletedInstances,
        bookmarks: bookmarks
      };
      this.dataService.persitUserInstances(userInstances, 'test').subscribe(() => {
        console.debug('New and updated instances have been persisted at the server.');
      });
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
