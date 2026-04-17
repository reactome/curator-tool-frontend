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
import { CommitResultDialogService, CommitResult } from "src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { CommitWaitDialogComponent } from "src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component";
import { concatMap, finalize, from, map, tap, toArray } from "rxjs";

// TODO: Referrers of deleted instances need to have the referred slot modified and an instanceEdit added to modifiedList 
@Injectable({
    providedIn: 'any'
})

export class DeletionService {
    private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;

    constructor(private dataService: DataService,
        private store: Store,
        private instanceUtilities: InstanceUtilities,
        private createDeletedDialogService: CreateDeletedDialogService,
        private commitDeletedDialogService: CommitDeletedDialogService,
        private deleteBulkDialogService: DeleteBulkDialogService,
        private commitResultDialogService: CommitResultDialogService,
        private dialog: MatDialog
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
        const existingInstances = instancesToDelete.filter(i => i.dbId >= 0);
        const newInstancesToRemove = instancesToDelete.filter(i => i.dbId < 0);

        newInstancesToRemove.forEach(instance => {
            this.store.dispatch(NewInstanceActions.remove_new_instance(this.instanceUtilities.makeShell(instance)));
            this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(this.instanceUtilities.makeShell(instance)));
        });

        if (existingInstances.length === 0) return;

        this.openCommitWaitDialog(
            'Committing Deleted Instances',
            'Please wait while selected deleted instances are committed one by one.'
        );

        from(existingInstances).pipe(
            concatMap(instance =>
                this.dataService.delete(instance).pipe(
                    tap(() => {
                        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
                        this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(instance));
                        this.instanceUtilities.setDeletedDbId(instance.dbId);
                    }),
                    map(() => ({ displayName: instance.displayName ?? String(instance.dbId), dbId: instance.dbId } as CommitResult))
                )
            ),
            toArray(),
            finalize(() => this.closeCommitWaitDialog())
        ).subscribe(results => {
            this.dataService.flagSchemaTreeForReload();
            this.commitResultDialogService.openDialog(results, 'Deleted Instances');
        });
    }
    createDeletedObject(instanceToDelete: Instance[]) {
        this.createDeletedDialogService.openDialog(instanceToDelete).afterClosed().subscribe(deletedObject => {
            if (deletedObject) {
                // Submit the Deleted instance, the selected instances are handled in this component
                this.openCommitWaitDialog(
                    'Committing Deleted Instances',
                    'Please wait while selected instances are committed as deleted.'
                );

                this.dataService.deleteByDeleted(deletedObject!).pipe(
                    finalize(() => this.closeCommitWaitDialog())
                ).subscribe(rtn => {

                    instanceToDelete.forEach(instance => {
                        this.store.dispatch(DeleteInstanceActions.remove_deleted_instance(instance));
                        this.store.dispatch(DeleteInstanceActions.commit_deleted_instance(instance));
                        this.instanceUtilities.setDeletedDbId(instance.dbId);
                    });

                    this.dataService.flagSchemaTreeForReload();

                    const results: CommitResult[] = instanceToDelete.map(instance => ({
                        displayName: instance.displayName ?? String(instance.dbId),
                        dbId: instance.dbId
                    }));
                    this.commitResultDialogService.openDialog(results, 'Deleted Instances');
                });
            }

        });
    }

    private openCommitWaitDialog(title: string, message: string) {
        this.closeCommitWaitDialog();
        this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
            disableClose: true,
            hasBackdrop: true,
            autoFocus: false,
            restoreFocus: false,
            data: { title, message }
        });
    }

    private closeCommitWaitDialog() {
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = undefined;
    }

    checkIsEventOrPE(instance: Instance): boolean {
        if (this.dataService.isEventClass(instance.schemaClassName) || this.dataService.isPhysicalEntityClass(instance.schemaClassName)) {
            return true;
        }
        return false;
    }

}
