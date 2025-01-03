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
import { defaultPerson, deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { InstanceBookmarkModule } from "../schema-view/instance-bookmark/instance-bookmark.module";
import { bookmarkedInstances } from "../schema-view/instance-bookmark/state/bookmark.selectors";
import { NgIf } from "@angular/common";
import { MatSnackBar } from "@angular/material/snack-bar";
import { UserInstancesService } from "../auth/login/user-instances.service";
import { ListInstancesDialogService } from "../schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service";
import { DefaultPersonActions } from "../instance/state/instance.actions";
import { DataService } from "../core/services/data.service";

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
    imports: [NgIf, MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule, CdkAccordionModule, InstanceBookmarkModule, MatIconModule, MatTooltipModule]
})
export class StatusComponent implements OnInit {
  @Input() hideInstanceStatus: boolean = false;
  @Output() showUpdatedEvent = new EventEmitter<boolean>();
  updatedInstances: Instance[] = [];
  newInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  bookmarkedInstances: Instance[] =  [];
  defaultPerson: Instance|undefined = undefined;

  constructor(private store: Store,
              private userInstancesService: UserInstancesService,
              private instanceSelectionService: ListInstancesDialogService,
              private router: Router,
            private dataService: DataService) {
  }

  private _snackBar = inject(MatSnackBar);

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action);
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      instances ? this.updatedInstances = instances : this.updatedInstances = [];
    });

    this.store.select(newInstances()).subscribe((instances) => {
      instances ? this.newInstances = instances : this.newInstances = [];
    });

    this.store.select(deleteInstances()).subscribe((instances) => {
      instances ? this.deletedInstances = instances : this.deletedInstances = [];
    });

    this.store.select(bookmarkedInstances()).subscribe((instances) => {
      instances ? this.bookmarkedInstances = instances : this.bookmarkedInstances = [];
    });

    this.store.select(defaultPerson()).subscribe((instances) => {
      // There should be only one default person
      instances && instances.length > 0 ? this.defaultPerson = instances[0] : this.defaultPerson = undefined
    });

    this.dataService.errorMessage$.subscribe((message: any) => {
      if (message)
        this.openSnackBar(message.error.message, 'Close');
    });
  }

  // Calling ngOnDestroy is not reliable: https://blog.devgenius.io/where-ngondestroy-fails-you-54a8c2eca0e0.
  @HostListener('window:beforeunload', ['$event'])
  persistInstances(): void {
    this.userInstancesService.persistInstances();
  }

  showUpdated(): void {
    this.showUpdatedEvent.emit(true);
  }

  setDefaultPerson(): void {
    // Set or change the default person instance
    const matDialogRef = this.instanceSelectionService.openDialog({schemaClassName: 'Person', title: 'Select default person'});
    matDialogRef.afterClosed().subscribe((result) => {
      if (result)
        this.store.dispatch(DefaultPersonActions.set_default_person(result as Instance))
    });
  }

  logout() {
    this.userInstancesService.persistInstances(true);
    this.router.navigate(["/login"]);
  }
}
