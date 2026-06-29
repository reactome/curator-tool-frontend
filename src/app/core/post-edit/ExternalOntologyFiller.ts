// fillExternalOntology can handle all classes under ExternalOntology 
// (Except GO related classes, which are handled by GO update script during release)

import { MatDialogRef, MatDialog } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import { finalize } from "rxjs";
import { CommitWaitDialogComponent } from "src/app/shared/components/commit-wait-dialog/commit-wait-dialog.component";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceUtilities } from "../services/instance.service";
import { InstanceNameGenerator } from "./InstanceNameGenerator";
import { PostEditOperation, PostEditListener } from "./PostEditOperation";

export class ExternalOntologyFiller implements PostEditOperation {

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
        if (editedAttributeName !== 'identifier' || instance.schemaClassName)
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
        this.dataService.psiModIdentifierMapping(instance).pipe(
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
            if (postEditListener)
                postEditListener.donePostEdit(instance, editedAttributeName);
            // this.dataService.fetchSchemaClass('Person').subscribe((personCls: SchemaClass) => {
            //     this.handleAuthors(instance, personCls);
            //     if (postEditListener)
            //         postEditListener.donePostEdit(instance, editedAttributeName);
            // });
        });
        return true;
    }


}