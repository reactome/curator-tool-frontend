import { Injectable } from "@angular/core";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { PathwayDiagramComponent } from "../pathway-diagram.component";
import { REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import {Core} from 'cytoscape';

/**
 * This class is used to validate the consistent between the displayed elements in the diagram and the
 * content of the instances these elements represent. For example, when a reaction is edited by removing
 * an input or output, the validation will make sure the same input or output is not linked to the displayed
 * reaction (i.e. edge) in the diagram.
 */
@Injectable()
export class PathwayDiagramValidator{

    handleInstanceEdit(instance: Instance | undefined, cy: Core | undefined) {
        console.debug('Handling instance edit: ' + instance?.displayName);
        if (!instance || !cy) return;
        // First check if we have any element having this instance
        const found = cy.elements(`[reactomeId = ${instance.dbId}]`);
        if (!found || found.length === 0)
            return; // The edited instance is not here
        // Make sure the changes we can handle
        // For Reaction, we should make sure input, output, catalyst and regulators are correct
        if (REACTION_TYPES.includes(instance.schemaClassName)) {
            // Since this is a reaction, we expected to see multiple elements, including edges and
            // a ReactionNode 
            this.validateReaction(found, instance);
        }
        // Regardless, check display name 
        for (let elm of found) {
            this.validateDisplayName(elm, instance);
        }
    }

    validateReaction(elm: any, instance: Instance) {

    }

    validateDisplayName(elm: any, instance: Instance) {
        if (!instance || elm.isEdge())
            return; // Need to work with nodes only
        if (instance.dbId !== elm.data('reactomeId'))
            return; // Just a sanity check
        if (instance.displayName) {
            const displayName = instance.displayName?.replace(/\s*\[.*?\]$/, '');
            elm.data('displayName', displayName);
        }
    }

}