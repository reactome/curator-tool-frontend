import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { Instance, SelectedInstancesList } from 'src/app/core/models/reactome-instance.model';
import { Router, ActivatedRoute } from "@angular/router";
import { ListInstancesModule } from "../../../schema-view/list-instances/list-instances.module";
import { Store } from "@ngrx/store";
import { deleteInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { newInstances } from 'src/app/instance/state/instance.selectors';
import { UpdateInstanceActions, NewInstanceActions, DeleteInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from 'src/app/core/services/data.service';
import { MatToolbar } from '@angular/material/toolbar';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DeletionDialogService } from 'src/app/instance/components/deletion-dialog/deletion-dialog.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from 'src/app/schema-view/list-instances/components/list-instances-view/table/instance-list-table/instance-list-table.component';
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";


@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
})
export class UpdatedInstanceListComponent implements OnInit {
  // instances to be committed
  // There will be a checkbox to manage toBeUploade
  // toBeUploaded: Instance[] = [];
  updatedInstanceActions: Array<ActionButton> = [ACTION_BUTTONS.COMPARE2DB, ACTION_BUTTONS.UNDO, ACTION_BUTTONS.COMMIT];
  deletedInstanceActions: Array<ActionButton> = [ACTION_BUTTONS.UNDO, ACTION_BUTTONS.COMMIT];
  newInstanceActionButtons: Array<ActionButton> = [ACTION_BUTTONS.DELETE, ACTION_BUTTONS.COMMIT];

  isSelection: boolean = false;
  newInstances: Instance[] = [];
  updatedInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  showHeader: boolean = false;

  // To notify the parent component to close this panel
  @Output() closeAction = new EventEmitter<undefined>();
  @Input() blockRoute: boolean = false;
  selectedUpdatedInstances: Instance[] = [];
  selectedNewInstances: Instance[] = [];
  selectedDeletedInstances: Instance[] = [];

  showCheck: boolean = false;

  readonly SelectedInstancesList = SelectedInstancesList; // To use in the html file

  constructor(private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private dataService: DataService,
    private instanceUtilities: InstanceUtilities,
    private deletionDialogService: DeletionDialogService) {
  }

  ngOnInit(): void {
    this.store.select(newInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.newInstances = instances;
    })
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.updatedInstances = instances;
    })
    this.store.select(deleteInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.deletedInstances = instances;
    })
    this.getSelectedInstances();
  }

  compareWithDB(instance: Instance) {
    if (this.blockRoute) {
      this.instanceUtilities.setLastClickedDbIdForComparison(instance.dbId);
      return;
    }
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    let newUrl = currentPathRoot[0] + "/instance/" + instance.dbId.toString();
    // Apparently there is a bug in Angular that confuses the configured router for list_instances
    // and instance view. Therefore, give it something more here.
    this.router.navigate([newUrl, "comparison", instance.dbId.toString()]);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      case "compare": {
        this.compareWithDB(actionButton.instance)
        break;
      }

      case "delete": {
        this.deletionDialogService.openDialog(actionButton.instance);
        break;
      }

      case "undo": {
        if (this.deletedInstances.includes(actionButton.instance))
          this.resetDeletedInstance(actionButton.instance);
        else
          this.resetUpdatedInstance(actionButton.instance);
        break;
      }

      case "upload": {
        this.commitInstance(actionButton.instance);
        break;
      }
      default: {
        console.error("Unknown action: ", actionButton);
        break;
      }
    }
  }

  private commitInstance(instance: Instance) {
    // instances in different list should have different call
    if (this.deletedInstances.includes(instance)) {
      this.dataService.delete(instance).subscribe(rtn => {
        // Have to subscript it. Otherwise, the http call will not be fired
        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
        this.instanceUtilities.setDeletedDbId(instance.dbId);
        this.dataService.flagSchemaTreeForReload();
      });
    }
    else if (this.updatedInstances.includes(instance)) {
      this.dataService.commit(instance).subscribe(rtn => {
        this.instanceUtilities.processCommit(instance, rtn, this.dataService);
      });
    }
    else if (this.newInstances.includes(instance)) {
      this.dataService.commit(instance).subscribe(rtn => {
        this.instanceUtilities.processCommit(instance, rtn, this.dataService);
      });
    }
  }

  private resetDeletedInstance(instance: Instance) {
    this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
    // Check if this is an updated instance or new instance: need to add them back.
    if (instance.dbId < 0) // In the current iteration, new intance will be deleted without being staged. Therefore,
      // this will not be called at all. Keeping it for completeness.
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instanceUtilities.makeShell(instance)));
    else if (instance.modifiedAttributes && instance.modifiedAttributes.length > 0)
      this.store.dispatch(UpdateInstanceActions.register_updated_instance(this.instanceUtilities.makeShell(instance)));
  }

  private resetUpdatedInstance(instance: Instance) {
    this.dataService.fetchInstance(instance.dbId).subscribe(inst => {
      this.store.dispatch(UpdateInstanceActions.reset_updated_instance({
        modifiedAttributes: inst.modifiedAttributes,
        instance: inst
      }));
    });
  }

  resetSelectedUpdatedInstances() {
    for (let instance of this.selectedUpdatedInstances) {
      this.resetUpdatedInstance(instance);
    }
    this.selectedUpdatedInstances = [];
    this.showCheck = false;
  }

  resetSelectedDeletedInstances() {
    for (let instance of this.selectedDeletedInstances) {
      this.resetDeletedInstance(instance);
    }
    this.selectedDeletedInstances = [];
    this.showCheck = false;
  }

  resetSelectedNewInstances() {
    for (let instance of this.selectedNewInstances) {
      this.store.dispatch(NewInstanceActions.remove_new_instance(this.instanceUtilities.makeShell(instance)));
      this.instanceUtilities.setDeletedDbId(instance.dbId); // Commit right away
    }
    this.selectedNewInstances = [];
    this.showCheck = false;
  }

  close() {
    this.closeAction.emit();
  }

  navigateUrl(instance: Instance) {
    if (this.blockRoute) {
      this.instanceUtilities.setLastClickedDbId(instance.dbId);
      return;
    }
    if (!this.isSelection)
      this.router.navigate(["/schema_view/instance/" + instance.dbId.toString()]);
  }

  onUpdatedSelectionChange(selectedInstances: Instance[]) {
    this.selectedUpdatedInstances = selectedInstances;
  }

  toggleSelectAll(selectAll: boolean) {
    this.showCheck = selectAll;
    if (this.showCheck) {
      this.showCheck = true;
    } else {
      this.selectedUpdatedInstances = this.updatedInstances;
      this.selectedUpdatedInstances = [];
      this.showCheck = false;
    }

    // TODO: emit this list back to table 
  }


  isInstanceSelected(listName: string, instance: Instance): boolean {
    return this.instanceUtilities.isInstanceSelected(listName, instance);
  }

  getSelectedInstances() {
    this.instanceUtilities.getSelectedInstances(SelectedInstancesList.updatedInstanceList).subscribe(selectedInstances => {
      this.selectedUpdatedInstances = selectedInstances;
    });
    this.instanceUtilities.getSelectedInstances(SelectedInstancesList.newInstanceList).subscribe(selectedInstances => {
      this.selectedNewInstances = selectedInstances;
    });
    this.instanceUtilities.getSelectedInstances(SelectedInstancesList.deletedInstanceList).subscribe(selectedInstances => {
      this.selectedDeletedInstances = selectedInstances;
    });
  }

  setSelectedInstances(listName: string, data: Instance[]) {
    this.instanceUtilities.addSelectedInstances(listName, data);
  }

  clearSelectedInstances(listName: string) {
    this.instanceUtilities.clearSelectedInstances(listName);
  }

  deleteAllSelectedNewInstances() {
    for (let instance of this.selectedNewInstances) {
      this.store.dispatch(NewInstanceActions.remove_new_instance(this.instanceUtilities.makeShell(instance)));
      this.instanceUtilities.setDeletedDbId(instance.dbId); // Commit right away
    }
    this.selectedNewInstances = [];
    this.showCheck = false;
  }
}
