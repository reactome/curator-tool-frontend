// Shared service to delegate created a Deleted Object 

import { Store } from "@ngrx/store";
import { SelectedInstancesList, Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { DeleteInstanceActions } from "../../state/instance.actions";
import { CreateDeletedDialogService } from "../components/deleted-object-creation-dialog/deleted-object-creation-dialog.service";
import { CommitDeletedDialogService } from "../components/deleted-object-creation-option-dialog/deleted-object-creation-option-dialog.service";
import { Injectable } from "@angular/core";

// Need to determine if instances is single or array
// createDeletedObject(instances: Instance[]): Observable<Instance> {
//     // First check if Deleted object is mandatory
//     // If mandatory open and create Deleted object dialog
//     // If not mandatory, open commit deleted dialog to confirm if user wants to create Deleted object

// }

// TODO: Figure out how to inject into the instance module level instead of root 
// TODO: Referrers of deleted instances need to have the referred slot modified and an instanceEdit added to modifiedList 
@Injectable({
    providedIn: 'root'
})

export class DeletionService {

    constructor(private dataService: DataService,
        private store: Store,
        private instanceUtilities: InstanceUtilities,
        private createDeletedDialogService: CreateDeletedDialogService,
        private commitDeletedDialogService: CommitDeletedDialogService) {
    }

    processDeletion(instancesToDelete: Instance[]) {
        // Check the schema class of every instance to see if a Deleted instance needs to be created
        let needDeleted = instancesToDelete.map(instance => { return this.checkIsEventOrPE(instance) });
        if (needDeleted.includes(true)) {
            this.createDeletedObject(instancesToDelete);
        }
        else {
            this.commitDeletedInstances(instancesToDelete);
        }
    }

    commitDeletedInstances(instancesToDelete: Instance[]) {

        this.commitDeletedDialogService.openDialog().afterClosed().subscribe(needDeleted => {
            if (needDeleted) {
                this.createDeletedObject(instancesToDelete);
            }
            else {
                // Just commit the deleted instances without creating Deleted instance
                instancesToDelete.forEach(instance => {
                    this.dataService.delete(instance).subscribe(rtn => {
                        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
                        this.instanceUtilities.setDeletedDbId(instance.dbId);
                        this.dataService.flagSchemaTreeForReload();
                    });
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
