import { Injectable } from "@angular/core";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { PathwayDiagramComponent } from "../pathway-diagram.component";
import { REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import {Core} from 'cytoscape';
import { DataService } from "src/app/core/services/data.service";

/**
 * This class is used to validate the consistent between the displayed elements in the diagram and the
 * content of the instances these elements represent. For example, when a reaction is edited by removing
 * an input or output, the validation will make sure the same input or output is not linked to the displayed
 * reaction (i.e. edge) in the diagram.
 */
@Injectable()
export class PathwayDiagramValidator{
    // A list of attributes in Reactome that should be checked
    private readonly REACTION_ATTRIBUTES = ['input', 'output', 'catalystActivity', 'regulatedBy'];

    constructor(private dataService: DataService) {}

    handleInstanceEdit(instance: Instance | undefined, attribute: string | undefined, cy: Core | undefined) {
        if (!instance || !cy || !attribute) return;
        // First check if we have any element having this instance
        const found = cy.elements(`[reactomeId = ${instance.dbId}]`);
        if (!found || found.length === 0)
            return; // The edited instance is not here
        // Make sure the changes we can handle
        // For Reaction, we should make sure input, output, catalyst and regulators are correct
        if (REACTION_TYPES.includes(instance.schemaClassName) && this.REACTION_ATTRIBUTES.includes(attribute)) {
            // Since this is a reaction, we expected to see multiple elements, including edges and
            // a ReactionNode 
            this.validateReaction(found, instance, attribute, cy);
        }
        // Regardless, check display name 
        for (let elm of found) {
            this.validateDisplayName(elm, instance);
        }
    }

    validateReaction(elms: any, instance: Instance, attribute: string, cy: Core) {
        // Get the current values
        const attValues = instance.attributes.get(attribute) ?? [];
        if (attribute === 'regulatedBy' || attribute === 'catalystActivity') {
            const attIds = attValues.map((att: Instance) => att.dbId);
            this.dataService.fetchInstances(attIds).subscribe((instances: Instance[]) => {
                if (instances === undefined)
                    instances = [];
                // Map to PE
                const pes = [];
                for (let inst of instances) {
                    if (attribute === 'regulatedBy') {
                        const regulator = inst.attributes?.get('regulator');
                        if (regulator !== undefined)
                            pes.push(regulator);
                    }
                    else if (attribute === 'catalystActivity') {
                        const catalyst = inst.attributes.get('physicalEntity');
                        if (catalyst !== undefined)
                            pes.push(catalyst);
                    }
                }
                this._validateReaction(elms, pes, attribute, cy);
            });
        }
        else {
            this._validateReaction(elms, attValues, attribute, cy);
        }
    }

    /**
     * The actual implementation to validate the display of a reaction for attribute editing.
     * @param elms
     * @param instance 
     * @param attribute 
     * @param cy 
     */
    private _validateReaction(elms: any, attValues: any[], attribute: string, cy: Core) {
        console.debug('validateReaction: ' + elms);
        // A reaction should have multiple elements: need to figure out 
        // elements related to the changed attribute
        // reactomeId -> elmId so that they can be compared with the instance
        // TODO: In the editing mode, an attribute may be mapped tomore than one element
        // Need to remove all of them if the assoicated PE is edited away.
        const reactomeId2elm = new Map();
        for (let elm of elms) {
            // Use class to figure out roles
            if (!elm.isEdge()) continue; // This may be a reaction node
            const role = this.getRole(elm);
            if (!attribute || role !== attribute) continue;
            const reactomeId = this.getReactomeId(elm, attribute);
            if (!reactomeId) continue;
            reactomeId2elm.set(reactomeId, elm);
        }
        // Now it is time to validate
        // From instance to edges: make sure all are displayed
        if (attValues.length > 0) {
            // Need to get regulator and catalyst!!!
            for (let attValue of attValues) {
                // Make sure this attribute is there
                if (!reactomeId2elm.has(attValue.dbId)) {
                    console.debug('Add a new ' + attribute + ", " + attValue.displayName);
                }
            }
        }
        // From edges to instance: make sure nothing extra are displayed 
        // For quick search
        const attDbIds = attValues.map((inst: Instance) => inst.dbId);
        for (let reactomeId of reactomeId2elm.keys()) {
            if (!attDbIds.includes(reactomeId)) {
                // Need to delete it
                const edge = reactomeId2elm.get(reactomeId);
                const peNode = this.getConnectedPENode(edge, attribute);
                cy.remove(edge);
                if (!peNode.connectedEdges() || peNode.connectedEdges().length === 0)
                    cy.remove(peNode); // Don't leave a node hanging there!
            }
        }
    }

    // Note: This method is very similar to getEdgeType in HyperEdge.
    private getRole(edge: any): string | undefined {
        // Based on the original definition
        if (edge.hasClass('consumption')) return "input";
        if (edge.hasClass('positive-regulation')) return "regulatedBy";
        // Cannot map back to "required"
        if (edge.hasClass('negative-regulation')) return "regulatedBy";
        if (edge.hasClass('catalysis')) return "catalystActivity";
        if (edge.hasClass('production')) return "output";
        return undefined; // The default
    }

    private getReactomeId(edge: any, attribute: string): number | undefined {
        const peElm = this.getConnectedPENode(edge, attribute);
        if (peElm)
            return peElm.data('reactomeId');
        return undefined;
    }

    /**
     * This should return a node representing a PhysicalEntity instance.
     * @param edge 
     * @param attribute 
     * @returns 
     */
    private getConnectedPENode(edge: any, attribute: string): any {
        let peNode = (attribute === 'output') ? edge.target() : edge.source();
        // Only need PE
        if (peNode.hasClass('PhysicalEntity')) {
            return peNode
        }
        return undefined;
    }

    validateDisplayName(elm: any, instance: Instance) {
        if (!instance || elm.isEdge())
            return; // Need to work with nodes only
        // a reaction node should not have display name
        if (elm.hasClass('reaction'))
            return;
        if (instance.dbId !== elm.data('reactomeId'))
            return; // Just a sanity check
        if (instance.displayName) {
            const displayName = instance.displayName?.replace(/\s*\[.*?\]$/, '');
            elm.data('displayName', displayName);
        }
    }

}