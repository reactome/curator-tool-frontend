import { finalize } from "rxjs";
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceNameGenerator } from "./InstanceNameGenerator";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { SchemaClass } from "../models/reactome-schema.model";
import { Store } from "@ngrx/store";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { InstanceUtilities } from "../services/instance.service";
import { CommitWaitDialogComponent } from 'src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component';

export class LiteratureReferenceFiller implements PostEditOperation {

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
        if (editedAttributeName !== 'pubMedIdentifier' || instance.schemaClassName !== 'LiteratureReference')
            return false; // Nothing to do
        this.commitWaitDialogRef?.close();
        this.commitWaitDialogRef = this.dialog.open(CommitWaitDialogComponent, {
            disableClose: true,
            hasBackdrop: true,
            autoFocus: false,
            restoreFocus: false,
            data: {
                title: 'PMID Handling',
                message: 'auto-fetch related information'
            }
        });
        this.dataService.fillReference(instance).pipe(
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
            this.dataService.fetchSchemaClass('Person').subscribe((personCls: SchemaClass) => {
                this.handleAuthors(instance, personCls);
                if (postEditListener)
                    postEditListener.donePostEdit(instance, editedAttributeName);
            });
        });
        return true;
    }

    /**
     * Authors created by the server have not display names and dbIds. This method is used to make sure they have.
     * @param instance
     * @returns
     */
    private handleAuthors(instance: Instance,
                          personCls: SchemaClass) {
        let authors = instance.attributes?.get('author');
        if (!authors) return;
        for (let author of authors) {
            if (author.dbId) // Old instance created before and fetched from the database
                continue; // This should be fine
            // This is a new author created by the server
            // Need to assign a new dbId
            author.dbId = this.dataService.getNextNewDbId();
            author.schemaClass = personCls;
            this.dataService.handleInstanceAttributes(author);
            if (this.nameGenerator)
                this.nameGenerator.updateDisplayName(author);
            // May need to bound these two calls together somewhere
            // Make sure to call these two at the end.
            this.dataService.registerInstance(author);
            this.store.dispatch(NewInstanceActions.register_new_instance(author));
        }
    }

}
