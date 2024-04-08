import { Instance } from "../models/reactome-instance.model";

/**
 * This is an interface providing a contract for performing post editing action (e.g. update display name,
 * pull detailed information from PubMed for LiteratureReference)
 */
export interface PostEditOperation {
    /**
     * Perform a post editing action.
     * @param instance the instance that has been edited
     * @param editedAttributeName the attrinute name that has been edited. This may be undefined for multiple attribute editing.
     * @returns true if the editing success.
     */
    postEdit(instance: Instance, 
             editedAttributeName: string | undefined,
             postEditListener: PostEditListener | undefined): boolean;
}

/**
 * This interface provides a contract for performing user interface update for anything after post editing is done (e.g.
 * refresh the instance table)
 */
export interface PostEditListener {
    
    donePostEdit(instance: Instance,
                 editedAttributeName: string | undefined) : boolean;

}