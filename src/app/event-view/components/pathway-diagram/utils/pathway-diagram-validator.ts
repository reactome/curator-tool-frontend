import { Injectable } from "@angular/core";
import { EDGE_POINT_CLASS, INPUT_HUB_CLASS, Instance, OUTPUT_HUB_CLASS, RENDERING_CONSTS } from "src/app/core/models/reactome-instance.model";
import { PathwayDiagramComponent } from "../pathway-diagram.component";
import { REACTION_DIAGRAM_ATTRIBUTES, REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import {Core} from 'cytoscape';
import { DataService } from "src/app/core/services/data.service";
import { InstanceConverter } from "./instance-converter";
import { DiagramService } from "ngx-reactome-diagram";
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { InstanceUtilities } from "src/app/core/services/instance.service";

/**
 * This class is used to validate the consistent between the displayed elements in the diagram and the
 * content of the instances these elements represent. For example, when a reaction is edited by removing
 * an input or output, the validation will make sure the same input or output is not linked to the displayed
 * reaction (i.e. edge) in the diagram.
 */
@Injectable()
export class PathwayDiagramValidator{
    
    constructor(private dataService: DataService,
        private instanceUtilities: InstanceUtilities,
        private converter: InstanceConverter,
        private diagramService: DiagramService
    ) {}

    handleInstanceEdit(instance: Instance | undefined, 
                       attribute: string | undefined, 
                       cy: Core | undefined) {
        if (!instance || !cy || !attribute) 
            return;
        if (instance.schemaClassName === 'CatalystActivity') {
            this.validateHelperNode(instance, attribute, 'physicalEdit', 'catalystActivity', cy);
            return;
        }
        if (this.instanceUtilities.isSchemaClass(instance, 'Regulation', this.dataService)) {
            this.validateHelperNode(instance, attribute, 'regulator', 'regulatedBy', cy);
            return;
        }
        // First check if we have any element having this instance
        const found = cy.elements(`[reactomeId = ${instance.dbId}]`);
        if (!found || found.length === 0)
            return; // The edited instance is not here
        // Make sure the changes we can handle
        // For Reaction, we should make sure input, output, catalyst and regulators are correct
        if (REACTION_TYPES.includes(instance.schemaClassName) && REACTION_DIAGRAM_ATTRIBUTES.includes(attribute)) {
            // Since this is a reaction, we expected to see multiple elements, including edges and
            // a ReactionNode 
            this.validateReaction(found, instance, attribute, cy);
        }
        else {
            for (let elm of found) {
                this.validateDisplayName(elm, instance);
            }
        }
    }

    private validateHelperNode(instance: Instance, 
                               editAtt: string, 
                               targetAtt: string,
                               rxtAtt: string,
                               cy: Core) {
        if (editAtt !== targetAtt)
            return; // Don't care
        this.dataService.getReferrers(instance.dbId).subscribe((referrers: any) => {
            if (referrers === undefined || referrers.length === 0)
                return;
            const regulatedEvents = referrers.filter((r: any) => r.attributeName === rxtAtt);
            if (regulatedEvents.length === 0)
                return;
            for (let regulatedEvent of regulatedEvents[0].referrers) {
                // Just switch to validate reaction 
                if (REACTION_TYPES.includes(regulatedEvent.schemaClassName)) {
                    // In case the reaction has not been loaded, load it first 
                    this.dataService.fetchInstance(regulatedEvent.dbId).subscribe((reaction: any) => {
                        this.handleInstanceEdit(reaction, rxtAtt, cy);
                    });
                }
            }
        });
    }

    private validateReaction(elms: any, instance: Instance, attribute: string, cy: Core) {
        // Get the current values
        const attValues = instance.attributes.get(attribute) ?? [];
        if (attribute === 'regulatedBy' || attribute === 'catalystActivity') {
            const attIds = attValues.map((att: Instance) => att.dbId);
            this.dataService.fetchInstances(attIds).subscribe((instances: Instance[]) => {
                if (instances === undefined)
                    instances = [];
                this._validateReaction(elms, instances, attribute, cy, instance);
            });
        }
        else {
            this._validateReaction(elms, attValues, attribute, cy, instance);
        }
    }

    /**
     * The actual implementation to validate the display of a reaction for attribute editing.
     * @param elms
     * @param instance 
     * @param attribute 
     * @param cy 
     */
    private _validateReaction(elms: any, attValues: any[], attribute: string, cy: Core, reaction: Instance) {
        // console.debug('validateReaction: ' + elms);
        // A reaction should have multiple elements: need to figure out 
        // elements related to the changed attribute
        // reactomeId -> elmId so that they can be compared with the instance
        // TODO: In the editing mode, an attribute may be mapped to more than one element
        // Need to remove all of them if the assoicated PE is edited away.
        const reactomeId2elm = new Map<number, any>();
        // Need to validate stoichiometry too
        const reactomeId2Stoi = new Map<number, number>();
        for (let elm of elms) {
            // Use class to figure out roles
            if (!elm.isEdge()) continue; // This may be a reaction node
            const role = this.getRole(elm);
            if (!attribute || role !== attribute) continue;
            const reactomeId = this.getConnectedPEId(elm, attribute);
            if (!reactomeId) continue;
            reactomeId2elm.set(reactomeId, elm);
            const stoi = elm.data('stoichiometry');
            reactomeId2Stoi.set(reactomeId, stoi);
        }
        // Now it is time to validate
        // Need to validate stoichiemtry too
        const newReactomeId2Stoi = new Map<number, number>();
        attValues.forEach(attValue => {
            newReactomeId2Stoi.set(attValue.dbId, (newReactomeId2Stoi.get(attValue.dbId) ?? 0) + 1);
        });
        // From instance to edges: make sure all are displayed
        const attDbIds = new Set();
        if (attValues.length > 0) {
            for (let attValue of attValues) {
                // Need to get the dbId of a PE
                const pe = this.getPEFromInstance(attValue, attribute);
                if (!pe)
                    continue;
                attDbIds.add(pe.dbId);
                // Make sure this attribute is there
                if (!reactomeId2elm.has(pe.dbId)) {
                    const newEdge = this.addInstanceToReaction(elms, attValue, attribute, cy, reaction);
                    if (newReactomeId2Stoi.get(pe.dbId)! > 1) {
                        newEdge?.data('stoichiometry', newReactomeId2Stoi.get(pe.dbId));
                    }
                }
                else { // Just check the stoichiometry. We only need to check from instance to edge 
                       // for stoichiometry. No need from edge to instance
                    const oldStoi = reactomeId2Stoi.get(pe.dbId) ?? 1;
                    if (oldStoi !== newReactomeId2Stoi.get(pe.dbId))
                        // the map is from pe's dbId to the connected edge
                        reactomeId2elm.get(pe.dbId).data('stoichiometry', newReactomeId2Stoi.get(pe.dbId));
                }
            }
        }
        // From edges to instance: make sure nothing extra are displayed 
        for (let reactomeId of reactomeId2elm.keys()) {
            if (!attDbIds.has(reactomeId)) {
                // Need to delete it
                const edge = reactomeId2elm.get(reactomeId);
                const peNode = this.getConnectedPENode(edge, attribute);
                cy.remove(edge);
                if (!peNode.connectedEdges() || peNode.connectedEdges().length === 0)
                    cy.remove(peNode); // Don't leave a node hanging there!
            }
        }
    }

    private getPEFromInstance(inst: Instance, attName: string) {
        if (attName === 'catalystActivity')
            return inst.attributes.get('physicalEntity');
        if (attName === 'regulatedBy')
            return inst.attributes.get('regulator');
        return inst; // input or output
    }

    private addInstanceToReaction(elms: any[], attValue: Instance, attribute: string, cy: Core, reaction: Instance) {
        // Check if there is a reaction node
        const reactionNodes = elms.filter(elm => (elm.isNode() && elm.hasClass('reaction') && !elm.hasClass(EDGE_POINT_CLASS)));
        if (reactionNodes.length === 0)
            return; // No reaction node. Do nothing. The reaction is not shown.
        const type = this.mapAttributeToType(attValue, attribute);
        if (type == undefined)
            return;
        let reactionNode = reactionNodes[0];
        // See if it is possible to find the input or output hub node
        let hubClass : string|undefined = undefined;
        if (attribute === 'input')
            hubClass = INPUT_HUB_CLASS;
        else if (attribute === 'output')
            hubClass = OUTPUT_HUB_CLASS;
        if (hubClass) {
            const hubNodes = elms.filter(elm => (elm.isNode() && elm.hasClass('reaction') && elm.hasClass(hubClass)));
            if (hubNodes.length > 0)
                reactionNode = hubNodes[0];
        }
        const peElm = this.converter.createPENode(this.getPEFromInstance(attValue, attribute), cy, undefined, this.diagramService);
        if (peElm.position().x === RENDERING_CONSTS.INIT_POSITION.x && peElm.position().y === RENDERING_CONSTS.INIT_POSITION.y) {
            const newPos = this.getPositionForNewNode(peElm, reactionNode, elms, attribute);
            peElm.position(newPos);
        }
        let source = undefined;
        let target = undefined;
        if (attribute === 'output') {
            source = reactionNode;
            target = peElm;
        }
        else {
            source = peElm;
            target = reactionNode;
        }
        return this.converter.createEdge(source, target, reaction, type, this.diagramService, cy);
    }

    /**
     * Note: This is a tempoary implementation to get a position for a new node close the reaction node or exisiting
     * nodes. A better way is needed by adopting the layout algorithm in HyperEdge to get a better default position.
     * or some simplied approaches:
     * 1). Extrapolate the line from input to reaction node for output so that the new output is in the same line if
     * output existing.
     * 2). If there are other outputs existing, use the center of these outputs with some shift
     * 3). Same for input.
     * 4). Follow the layout algorithm for new accesssary nodes.
     * @param peNode 
     * @param reactionNode 
     * @param elms 
     * @param attribute 
     * @returns 
     */
    private getPositionForNewNode(peNode: any, reactionNode: any, elms: any[], attribute: string) {
        if (attribute === 'input' || attribute === 'output') {
            // If there is other input/output, put this new node around existing one
            const existingNodes = elms.filter(elm => (elm.isEdge() && this.getRole(elm) === attribute) && elm.target().hasClass('PhysicalEntity'));
            const position = this.calculateCenter(existingNodes, reactionNode);
            return {
                x: position.x + 20 * Math.random(), // 20 is used for the time being
                y: position.y + 20 * Math.random()
            }
        }
        // Default is around the reaction node
        return {
            x: reactionNode.position().x + 20 * Math.random() + RENDERING_CONSTS.DEFAULT_DISTANCE_FROM_REACTION_PE_NODE,
            y: reactionNode.position().y + 20 * Math.random() + RENDERING_CONSTS.DEFAULT_DISTANCE_FROM_REACTION_PE_NODE
        }
    }

    private calculateCenter(nodes: any, reactionNode: any): Position {
        if (!nodes || nodes.length == 0) {
            return {
                x: reactionNode.position().x + RENDERING_CONSTS.DEFAULT_DISTANCE_FROM_REACTION_PE_NODE,
                y: reactionNode.position().y + RENDERING_CONSTS.DEFAULT_DISTANCE_FROM_REACTION_PE_NODE
            };
        }
        let sum_x = 0;
        let sum_y = 0;
        for (let node of nodes) {
            sum_x += node.position().x;
            sum_y += node.position().y;
        }
        return {x: sum_x / nodes.length, y: sum_y / nodes.length};
    }

    private mapAttributeToType(attValue: Instance, attribute: string): string | undefined {
        if (attribute === 'input') return 'INPUT';
        if (attribute === 'output') return 'OUTPUT';
        if (attribute === 'catalystActivity') return 'CATALYST';
        if (attribute === 'regulatedBy') {
            if (this.instanceUtilities.isSchemaClass(attValue, 'Requirement', this.dataService))
                return 'REQUIRED'; 
            if (this.instanceUtilities.isSchemaClass(attValue, 'PositiveRegulation', this.dataService))
                return 'ACTIVATOR'; 
            if (this.instanceUtilities.isSchemaClass(attValue, 'NegativeRegulation', this.dataService))
                return 'INHIBITOR';
        }
        return undefined;
    }

    private getReactionNode(reactionDbId: number, cy: Core) {
        const elm = cy.nodes().filter(node => node.data('reactomeId') === reactionDbId)
                               .filter(node => node.hasClass('reaction') && !node.hasClass(EDGE_POINT_CLASS))
                               .first();
        return elm;
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

    private getConnectedPEId(edge: any, attribute: string): number | undefined {
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