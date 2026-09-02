import { Injectable } from "@angular/core";
import { EDGE_POINT_CLASS, INPUT_HUB_CLASS, Instance, OUTPUT_HUB_CLASS, RENDERING_CONSTS } from "src/app/core/models/reactome-instance.model";
import { REACTION_DIAGRAM_ATTRIBUTES, REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import {Core} from 'cytoscape';
import { DataService } from "src/app/core/services/data.service";
import { InstanceConverter } from "./instance-converter";
import { DiagramService } from "ngx-reactome-diagram";
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { HyperEdge } from "./hyperedge";

/**
 * This class is used to validate the consistent between the displayed elements in the diagram and the
 * content of the instances these elements represent. For example, when a reaction is edited by removing
 * an input or output, the validation will make sure the same input or output is not linked to the displayed
 * reaction (i.e. edge) in the diagram.
 */
@Injectable()
export class PathwayDiagramValidator{
    // For reaction-based editing, we need to make sure the data structure is correct
    // when in editing
    hyperEdge: HyperEdge|undefined = undefined;
    
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
            this.validateHelperNode(instance, attribute, 'physicalEntity', 'catalystActivity', cy);
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

    needReactionValidation(instance: Instance, attribute: string) {
        if (REACTION_TYPES.includes(instance.schemaClassName) && REACTION_DIAGRAM_ATTRIBUTES.includes(attribute))
            return true;
        return false;
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
        // Resolve every attValue to its underlying PE/regulator dbId FIRST, and aggregate both
        // the desired stoichiometry and one representative attValue per unique dbId, before
        // touching the diagram. This must happen up front rather than inline in the loop below,
        // for two reasons:
        // 1) For catalystActivity/regulatedBy, attValue is the CatalystActivity/Regulation
        //    helper instance, not the catalyst/regulator itself - keying by attValue.dbId (as
        //    this used to) rather than the resolved pe.dbId meant this map was never actually
        //    looked up successfully for those two attributes, so an already-correct edge's
        //    stoichiometry got stomped to undefined on every single validation pass.
        // 2) attValues can legitimately contain the same resolved dbId more than once - input/
        //    output arrays are stoichiometry-expanded (the same participant appears once per
        //    unit of stoichiometry), and a reaction can have more than one CatalystActivity/
        //    Regulation helper resolving to the same physicalEntity/regulator. Deduping here
        //    means the add/update loop below visits each dbId exactly once.
        const newReactomeId2Stoi = new Map<number, number>();
        const newReactomeId2AttValue = new Map<number, any>();
        // For catalystActivity/regulatedBy, attValue is the CatalystActivity/Regulation helper
        // instance, and getPEFromInstance() has to drill into its physicalEntity/regulator
        // attribute to find the actual PhysicalEntity - that attribute is only populated once the
        // helper instance has been fully fetched (see validateReaction() above). If that fetch
        // hasn't resolved it for one of the attValues (a slow/failed fetchInstances() call, a
        // helper instance with the attribute genuinely still unset, etc.), getPEFromInstance()
        // returns undefined - the raw, unresolved CatalystActivity/Regulation is NOT a
        // PhysicalEntity and must never be substituted for one. Silently skipping just that
        // attValue would drop it out of attDbIds below, and the edge already correctly drawn for
        // its real (but now unresolved) PhysicalEntity would then look "extra" and get removed by
        // the from-edges-to-instance pass, only to be re-added as a brand new edge (in a new
        // position) on a later pass once it resolves - exactly the "extra catalyst link" symptom.
        // Bailing out of the whole attribute validation here instead leaves the diagram untouched
        // until every participant resolves.
        let hasUnresolvedParticipant = false;
        attValues.forEach(attValue => {
            const pe = this.getPEFromInstance(attValue, attribute);
            if (!pe) {
                hasUnresolvedParticipant = true;
                return;
            }
            newReactomeId2Stoi.set(pe.dbId, (newReactomeId2Stoi.get(pe.dbId) ?? 0) + 1);
            if (!newReactomeId2AttValue.has(pe.dbId))
                newReactomeId2AttValue.set(pe.dbId, attValue);
        });
        if (hasUnresolvedParticipant) {
            console.warn(`Skipping reaction structure validation for ${reaction.dbId}'s ${attribute}: ` +
                `could not resolve the physicalEntity/regulator for one or more entries.`);
            return;
        }
        // From instance to edges: make sure all are displayed
        const attDbIds = new Set<number>(newReactomeId2Stoi.keys());
        for (const [peDbId, attValue] of newReactomeId2AttValue) {
            const newCount = newReactomeId2Stoi.get(peDbId)!;
            // Make sure this attribute is there
            if (!reactomeId2elm.has(peDbId)) {
                const newEdge = this.addInstanceToReaction(elms, attValue, attribute, cy, reaction);
                if (newCount > 1) {
                    newEdge?.data('stoichiometry', newCount);
                }
                // Register the just-added edge immediately so a later dbId in this same pass
                // (there won't be one now that attValues is deduped above, but keep this in
                // case addInstanceToReaction is ever reused elsewhere) is never re-added.
                if (newEdge) reactomeId2elm.set(peDbId, newEdge);
            }
            else { // Just check the stoichiometry. We only need to check from instance to edge
                   // for stoichiometry. No need from edge to instance
                const oldStoi = reactomeId2Stoi.get(peDbId) ?? 1;
                if (oldStoi !== newCount)
                    // the map is from pe's dbId to the connected edge
                    reactomeId2elm.get(peDbId).data('stoichiometry', newCount);
            }
        }
        // From edges to instance: make sure nothing extra are displayed
        for (let reactomeId of reactomeId2elm.keys()) {
            if (!attDbIds.has(reactomeId)) {
                // Need to delete it
                const edge = reactomeId2elm.get(reactomeId);
                const peNode = this.getConnectedPENode(edge, attribute);
                // The edge tracked here is only the segment directly touching peNode - for a
                // multi-segment connector (see getRole()'s comment) that's just one link in a
                // chain of edge-point-mediated edges leading to the reaction. Removing only this
                // segment would leave the rest of the chain (intermediate edge-point nodes and
                // their edges) dangling in the diagram, connected to the reaction but going
                // nowhere. Collect and remove the whole chain instead.
                const chainPoints = this.collectConnectorChainPoints(edge, peNode);
                cy.remove(edge);
                if (this.hyperEdge)
                    this.hyperEdge.deRegisterObject(edge);
                for (const point of chainPoints) {
                    cy.remove(point); // Also removes any edge still touching this point
                    if (this.hyperEdge)
                        this.hyperEdge.deRegisterObject(point);
                }
                if (!peNode.connectedEdges() || peNode.connectedEdges().length === 0) {
                    cy.remove(peNode); // Don't leave a node hanging there!
                    if (this.hyperEdge)
                        this.hyperEdge.deRegisterObject(peNode);
                }
            }
        }
    }

    /**
     * Walk a multi-segment connector's chain of intermediate edge-point nodes, starting from the
     * segment directly touching peNode, until reaching a node that isn't an edge point (normally
     * the reaction node). Returns an empty array for a plain single-segment connector.
     */
    private collectConnectorChainPoints(startEdge: any, peNode: any): any[] {
        const points: any[] = [];
        let current = startEdge.source().id() === peNode.id() ? startEdge.target() : startEdge.source();
        let cameFromEdgeId = startEdge.id();
        const MAX_HOPS = 50; // Safety guard - a real chain is never this long
        for (let i = 0; i < MAX_HOPS && current.hasClass(EDGE_POINT_CLASS); i++) {
            points.push(current);
            const nextEdges = current.connectedEdges().filter((e: any) => e.id() !== cameFromEdgeId);
            if (nextEdges.length !== 1)
                break; // A hub (3+ edges) or a dead end - stop walking rather than guess
            const nextEdge = nextEdges[0];
            cameFromEdgeId = nextEdge.id();
            current = nextEdge.source().id() === current.id() ? nextEdge.target() : nextEdge.source();
        }
        return points;
    }

    private getPEFromInstance(inst: Instance, attName: string) {
        if (attName === 'catalystActivity')
            return inst.attributes.get('physicalEntity');
        if (attName === 'regulatedBy')
            return inst.attributes.get('regulator');
        return inst; // input or output
    }

    /**
     * In case we need to add a new node as input or output to a reaction has only one input or output,
     * we need to create a hub node if we cannot find one.
     */
    private ensureHubNode(reactionNode: any, hubClass: string, cy: Core) {
        if (!this.hyperEdge)
            return; // Do nothing if there is no hyperedge associated 
        // Need to figure out the location of the hub node
        const connectedEdges = reactionNode.connectedEdges();
        let targetEdge = undefined;
        for (let edge of connectedEdges) {
            if (hubClass === INPUT_HUB_CLASS && edge.hasClass('consumption')) {
                targetEdge = edge;
                break;
            }
            else if (hubClass === OUTPUT_HUB_CLASS && edge.hasClass('production')) {
                targetEdge = edge;
                break;
            }
        }
        // Just pick one in case nothing there
        if (!targetEdge && connectedEdges.length > 0){
            // Just pick the first one
            for (let edge of connectedEdges) {
                if ((hubClass === OUTPUT_HUB_CLASS) && (edge.hasClass('outgoing') || edge.hasClass('production'))) {
                    targetEdge = edge;
                    break;
                }
                else if ((hubClass === INPUT_HUB_CLASS) && edge.hasClass('input')) {
                    targetEdge = edge;
                    break;
                }
            }
            if (!targetEdge) // Just pick the first one
                targetEdge = connectedEdges[0];
        }   
        if (!targetEdge)
            return; // No edge to use
        // Need to get the position of the hub node         
        const source = targetEdge.source().position();
        const target = targetEdge.target().position();
        const zoom = cy.zoom();
        const pan = cy.pan();
        const insertPos = {
            x: ((source.x + target.x) / 2) * zoom + pan.x,
            y: ((source.y + target.y) / 2) * zoom + pan.y
        }
        const nodeId = this.hyperEdge.insertNode(insertPos, targetEdge);
        const node = this.hyperEdge.getRegisteredObject(nodeId);
        node.addClass(hubClass);
        return node;
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
            else if (reaction.attributes.get(attribute).length > 1) {
                reactionNode = this.ensureHubNode(reactionNode, hubClass, cy);
            }
        }
        const peElm = this.converter.createPENode(this.getPEFromInstance(attValue, attribute), cy, undefined, this.diagramService);
        if (this.hyperEdge)
            this.hyperEdge.registerObject(peElm);
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
        const newEdge = this.converter.createEdge(source, target, reaction, type, this.diagramService, cy);
        if (this.hyperEdge) 
            this.hyperEdge.registerObject(newEdge);
        return newEdge;
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
            // Got edges first
            const validEdges = elms.filter(elm => (elm.isEdge() && this.getRole(elm) === attribute) && 
                                                     (elm.target().hasClass('PhysicalEntity') || elm.source().hasClass('PhysicalEntity')));
            const existingNodes = [];
            for (let edge of validEdges) {
                if (edge.target().hasClass('PhysicalEntity'))
                    existingNodes.push(edge.target());
                else if (edge.source().hasClass('PhysicalEntity'))
                    existingNodes.push(edge.source());
            }
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
        // HyperEdge.expandEdges()/insertNode() split one connector into a chain of edges through
        // intermediate edge-point nodes, and deliberately restyle every segment but the one next
        // to the reaction node to a plain, arrow-less "consumption" look (see the comments there)
        // -- that segment carries this data field with the connector's true role instead, so it
        // isn't lost. Edges that were never split (freshly added ones, or single-segment
        // connectors) never get this field and fall through to the class-based checks below.
        const role = edge.data('role');
        if (role) return role;
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