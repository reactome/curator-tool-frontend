import { MatDialogRef, MatDialog } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import { finalize } from "rxjs";
import { CommitWaitDialogComponent } from "src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { InstanceNameGenerator } from "./InstanceNameGenerator";
import { PostEditOperation, PostEditListener } from "./PostEditOperation";
import { SchemaClass } from "../models/reactome-schema.model";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";

export class ReferenceSequenceAutoFiller implements PostEditOperation {

    // Also need a display name generator after filling
    private nameGenerator?: InstanceNameGenerator;
    private commitWaitDialogRef?: MatDialogRef<CommitWaitDialogComponent>;

    constructor(private dataService: DataService,
        private store: Store,
        private utilities: InstanceUtilities,
        private dialog: MatDialog) {
        this.nameGenerator = new InstanceNameGenerator(this.dataService, this.utilities);
    }

    postEdit(instance: Instance,
        editedAttributeName: string | undefined,
        postEditListener: PostEditListener | undefined): boolean {
        if (editedAttributeName !== 'identifier' || (instance.schemaClassName !== 'ReferenceGeneProduct'
            && instance.schemaClassName !== 'ReferencePeptideSequence'
            && instance.schemaClassName !== 'ReferenceRNASequence'
            && instance.schemaClassName !== 'ReferenceIsoform'))
            return false; // Nothing to do
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
            disableClose: true,
            hasBackdrop: true,
            autoFocus: false,
            restoreFocus: false,
            data: {
                title: 'Identifier Handling',
                message: 'auto-fetch related information'
            }
        });
        this.dataService.fillReferenceSequence(instance).pipe(
            finalize(() => {
                this.commitWaitDialogRef?.close();
                this.commitWaitDialogRef = undefined;
            })
        ).subscribe(filled => {
            // Copy values from the old to new.
            // Try this and see if it works
            instance.attributes = filled.attributes;
            if (this.nameGenerator) {
                this.nameGenerator.updateDisplayName(instance);
            }
            let isoformIds = instance.attributes?.get('isoformIds') 
            if (isoformIds && isoformIds.length > 0) {
                this.dataService.fetchSchemaClass('ReferenceIsoform').subscribe((refIsoCls: SchemaClass) => {
                    this.handleIsoForms(instance, refIsoCls);
                    if (postEditListener)
                        postEditListener.donePostEdit(instance, editedAttributeName);
                });
            }
        });
        return true;
    }

    handleIsoForms(instance: Instance, refIsoCls: SchemaClass) {
        let isoformIds = instance.attributes?.get('isoformIds')
        if (!isoformIds) return;
        for (let isoformId of isoformIds) {

            let isoform = this.utilities.cloneInstanceForCommit(instance);
            // cloneInstanceForCommit serializes attributes to plain object for commits.
            // Convert back to Map so we can safely apply in-memory attribute updates.
            this.dataService.handleInstanceAttributes(isoform);
            isoform.attributes.set('identifier', isoformId);
            // This is a new isoform created by the server
            // Need to assign a new dbId
            isoform.dbId = this.dataService.getNextNewDbId();
            isoform.attributes.set('isoformParent', instance);
            isoform.schemaClassName = refIsoCls.name;
            isoform.schemaClass = refIsoCls;
            if (this.nameGenerator)
                this.nameGenerator.updateDisplayName(isoform);
            // May need to bound these two calls together somewhere
            // Make sure to call these two at the end.
            this.dataService.registerInstance(isoform);
            this.store.dispatch(NewInstanceActions.register_new_instance(isoform));
        }
    }

}