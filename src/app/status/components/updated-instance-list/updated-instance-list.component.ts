import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatTableModule} from '@angular/material/table';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {Router, ActivatedRoute} from "@angular/router";
import {ListInstancesModule} from "../../../schema-view/list-instances/list-instances.module";
import {Store} from "@ngrx/store";
import {deleteInstances, updatedInstances} from 'src/app/instance/state/instance.selectors';
import { newInstances } from 'src/app/instance/state/instance.selectors';
import { UpdateInstanceActions, NewInstanceActions, DeleteInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from 'src/app/core/services/data.service';
import { MatToolbar } from '@angular/material/toolbar';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DeletionDialogService } from 'src/app/instance/components/deletion-dialog/deletion-dialog.service';


@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule, ListInstancesModule, MatToolbar],
})
export class UpdatedInstanceListComponent implements OnInit{
  // instances to be committed
  // There will be a checkbox to manage toBeUploade
  // toBeUploaded: Instance[] = [];
  updatedInstanceActions: string[] = ['compare', "undo", "upload"];
  deletedInstanceActions: string[] = ['undo', 'upload']
  newInstanceActionButtons: string[] = ["delete", 'upload'];

  isSelection: boolean = false;
  newInstances: Instance[] = [];
  updatedInstances: Instance[] = [];
  deletedInstances: Instance[] = [];
  showHeader: boolean = false;
  @Output() closeAction = new EventEmitter<undefined>();
  @Input() blockRoute: boolean = false;

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
  }

  compareWithDB(instance: Instance) {
    if (this.blockRoute) {
      this.instanceUtilities.setLastClickedDbIdForComparison(instance.dbId);
      return;
    }
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
                                                   .reduce((acc, val) => acc.concat(val), [])
                                                   .map(urlSegment => urlSegment.path);
    let newUrl =  currentPathRoot[0] + "/instance/" + instance.dbId.toString();
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
    }
  }

  private commitInstance(instance: Instance) {
    // instances in different list should have different call
    if (this.deletedInstances.includes(instance)) {
      this.dataService.delete(instance).subscribe(rtn => {
        // Have to subscript it. Otherwise, the http call will not be fired
        console.log('Deleted instance: ' + instance.dbId);
        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
        this.instanceUtilities.setDeletedDbId(instance.dbId);
        this.dataService.flagSchemaTreeForReload();
      });
    }
    else if (this.updatedInstances.includes(instance)) {
      this.dataService.commit(instance).subscribe(rtn => {
        console.log('Updated instances: ' + rtn.dbId);
        this.store.dispatch(UpdateInstanceActions.remove_updated_instance(instance));
      });
    }
    else if (this.newInstances.includes(instance)) {
      this.dataService.commit(instance).subscribe(rtn => {
        console.log('Created instance: ' + rtn.dbId);
        // Use old instance since it is the old dbId
        this.store.dispatch(NewInstanceActions.remove_new_instance(instance));
        this.store.dispatch(NewInstanceActions.commit_new_instance({oldDbId: instance.dbId, newDbId: rtn.dbId}));
        this.dataService.flagSchemaTreeForReload();
      });
    }
  }

  private resetDeletedInstance(instance: Instance) {
    this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
    // Check if this is an updated instance or new instance: need to add them back.
    if (instance.dbId < 0)
      this.store.dispatch(NewInstanceActions.register_new_instance(instance));
    else if (instance.modifiedAttributes && instance.modifiedAttributes.length > 0)
      this.store.dispatch(UpdateInstanceActions.register_updated_instance(instance));
  }

  private resetUpdatedInstance(instance: Instance) {
    this.dataService.fetchInstance(instance.dbId).subscribe(inst => {
      this.store.dispatch(UpdateInstanceActions.reset_updated_instance({
        modifiedAttributes: inst.modifiedAttributes,
        instance: inst
      }));
    });
  }

  private deleteNewInstance(instance: Instance) {
    this.store.dispatch(NewInstanceActions.remove_new_instance(instance));
    this.dataService.removeInstanceInCache(instance.dbId);
    // TODO: The following cleaning up needs to be done:
    // 1). Remove the reference to this instance in any local changed instances
    // 2). Remove it from the bookmarks in case it is registered there.
    // To implement the above, consider to use ngrx's effects and add a new action.
  }

  close() {
    this.closeAction.emit();
  }

}
