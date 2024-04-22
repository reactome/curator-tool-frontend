import { concatMap } from "rxjs";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceNameGenerator } from "./InstanceNameGenerator";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { SchemaClass } from "../models/reactome-schema.model";
import { Store } from "@ngrx/store";
import { NewInstanceActions } from "src/app/schema-view/instance/state/instance.actions";

export class LiteratureReferenceFiller implements PostEditOperation {

    // Also need a display name generator after filling
    private nameGenerator?: InstanceNameGenerator;

    constructor(private dataService: DataService,
                private store: Store) {
        this.nameGenerator = new InstanceNameGenerator(this.dataService);
    }

    //TODO: This is a slow process and needs to add a waiting spin.
    postEdit(instance: Instance, 
             editedAttributeName: string | undefined,
             postEditListener: PostEditListener | undefined): boolean {
        if (editedAttributeName !== 'pubMedIdentifier' || instance.schemaClassName !== 'LiteratureReference')
            return false; // Nothing to do
        this.dataService.fillReference(instance).subscribe(filled => {
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
            })
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
            this.dataService.registerNewInstance(author);
            this.store.dispatch(NewInstanceActions.register_new_instances(author));
        }
    }

}