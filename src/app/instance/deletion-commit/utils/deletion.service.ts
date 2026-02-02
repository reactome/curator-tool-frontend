// Shared service to delegate created a Deleted Object 

import { Store } from "@ngrx/store";
import { SelectedInstancesList, Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { DeleteInstanceActions, NewInstanceActions } from "../../state/instance.actions";
import { CreateDeletedDialogService } from "../components/deleted-object-creation-dialog/deleted-object-creation-dialog.service";
import { CommitDeletedDialogService } from "../components/deleted-object-creation-option-dialog/deleted-object-creation-option-dialog.service";
import { Injectable } from "@angular/core";
import { DeleteBulkDialogService } from "src/app/schema-view/list-instances/components/delete-bulk-dialog/delete-bulk-dialog.service";

// TODO: Referrers of deleted instances need to have the referred slot modified and an instanceEdit added to modifiedList 
@Injectable({
    providedIn: 'any'
})

export class DeletionService {

    constructor(private dataService: DataService,
        private store: Store,
        private instanceUtilities: InstanceUtilities,
        private createDeletedDialogService: CreateDeletedDialogService,
        private commitDeletedDialogService: CommitDeletedDialogService,
        private deleteBulkDialogService: DeleteBulkDialogService
    ) {
    }

    processDeletion(instancesToDelete: Instance[]) {
        // Check the schema class of every instance to see if a Deleted instance needs to be created
        let needDeleted = instancesToDelete.map(instance => { return this.checkIsEventOrPE(instance) });
        let newInstances = instancesToDelete.filter(instance => instance.dbId < 0);
        // If all instancesToDelete are new instances, no need to create Deleted instance
        if (newInstances.length > 0) {

            this.deleteBulkDialogService.openDialog(instancesToDelete).afterClosed().subscribe(confirmed => {
                if (confirmed) {
                    this.commitWithoutDeletedInstance(instancesToDelete);
                }
            });
            return;
        }
        if (needDeleted.includes(true)) {
            this.createDeletedObject(instancesToDelete);
        }
        else {
            this.commitDeletedInstances(instancesToDelete);
        }
    }

    commitDeletedInstances(instancesToDelete: Instance[]) {
        let newInstances = instancesToDelete.filter(instance => instance.dbId < 0);
        if (newInstances.length === instancesToDelete.length) {
            this.commitWithoutDeletedInstance(instancesToDelete);
            return;
        }

        this.commitDeletedDialogService.openDialog().afterClosed().subscribe(needDeleted => {
            // If all instancesToDelete are new instances, no need to create Deleted instance
            if (newInstances.length !== instancesToDelete.length && needDeleted) {
                this.createDeletedObject(instancesToDelete);
            }
            else {
                this.commitWithoutDeletedInstance(instancesToDelete);
            }
        });
    }

    commitWithoutDeletedInstance(instancesToDelete: Instance[]) {
        // Just commit the deleted instances without creating Deleted instance
        instancesToDelete.forEach(instance => {
            if (instance.dbId < 0) {
                this.store.dispatch(NewInstanceActions.remove_new_instance(this.instanceUtilities.makeShell(instance)));
                this.instanceUtilities.setDeletedDbId(instance.dbId); // Commit right away
            }
            else {
                this.dataService.delete(instance).subscribe(rtn => {
                    this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
                    this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(instance));
                    this.instanceUtilities.setDeletedDbId(instance.dbId);
                    this.dataService.flagSchemaTreeForReload();
                });
            }
        });

    }
    createDeletedObject(instanceToDelete: Instance[]) {
        this.createDeletedDialogService.openDialog(instanceToDelete).afterClosed().subscribe(deletedObject => {
            if (deletedObject) {
                // Submit the Deleted instance, the selected instances are handled in this component
                this.dataService.deleteByDeleted(deletedObject!).subscribe(rtn => {

                    instanceToDelete.forEach(instance => {
                        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
                        this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(instance));
                        this.instanceUtilities.setDeletedDbId(instance.dbId);
                    });

                    this.dataService.flagSchemaTreeForReload();
                });
            }

        });
    }

    checkIsEventOrPE(instance: Instance): boolean {
        if (this.dataService.isEventClass(instance.schemaClassName) || this.dataService.isPhysicalEntityClass(instance.schemaClassName)) {
            return true;
        }
        return false;
    }

}
