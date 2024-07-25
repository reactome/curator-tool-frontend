import { DiagramComponent, DiagramService } from "ngx-reactome-diagram";
import { EdgeDefinition, NodeDefinition, Core } from 'cytoscape';
import { array } from 'vectorious';
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { Injectable } from "@angular/core";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { HyperEdge } from "./hyperedge";
import { InstanceConverter } from "./instance-converter";

@Injectable()
export class PathwayDiagramUtilService {
    diagramService: DiagramService | undefined = undefined;
    // Cache all converted HyperEdges for easy editing
    private id2hyperEdge : Map<number, HyperEdge> = new Map();
    // For resizing
    private readonly RESIZE_NODE_LOCATIONS: string[] = ['ne', 'nw', 'se', 'sw'];
    // To check reaction: A lazy way to list all reactions so that
    // there is no need to fetch the reaction hierarchical branch.
    private readonly REACTION_TYPES = [
        'BlackBoxEvent',
        'CellDevelopmentStep',
        'Depolymerisation',
        'Polymerisation',
        'FailedReaction',
        'Reaction'
    ];
    private converter = new InstanceConverter();
    
    constructor(private dataSerice: DataService
    ) { }

    isEdgeEditable(element: any): boolean {
        if (element === undefined || element === null)
            return false;
        // A reaction node is a node. But its dbId should be used
        // in id2hyperEdges if the reaction for this node has been expanded.
        // Therefore, we don't need to check if the element is an edge.
        const dbId = element.data('reactomeId');
        if (dbId && this.id2hyperEdge.has(dbId))
            return true;
        return false; // default
    }


    deleteHyperEdge(element: any) {
        if (!element) return; 
        const dbId = element.data('reactomeId');
        if (!dbId || !this.id2hyperEdge.has(dbId))
            return; // Do nothing. No hyper edge associated with this dbId
        const hyperEdge = this.id2hyperEdge.get(dbId);
        if (!hyperEdge) return; // Just in case. This should not occur
        hyperEdge.delete();
        // Remove it from the register.
        this.id2hyperEdge.delete(dbId);
    }

    addNewEvent(event: Instance, cy: Core) {
        // For the time being, we will use this simple check only.
        // But the actual check should be based on schema class tree in the future
        if (this.REACTION_TYPES.includes(event.schemaClassName)) {
            // For threading issue, we have to do like this way instead of creating an HyperEdge directly by converter.
            const hyperEdge = new HyperEdge(this, cy, event.dbId);
            hyperEdge.createFromEvent(event, this.dataSerice, this.converter);
            this.id2hyperEdge.set(event.dbId, hyperEdge);
        }
    }

    
    /**
     * Check if the passed event instance has been added in the diagram already.
     * @param event
     * @param cy 
     */
    isEventAdded(event: Instance, cy: Core): boolean {
        // We just check if any element has this dbId
        // If a reaction has been added, an edge and a reaction node should have this.
        const exitedNodes = cy.nodes().filter(node => node.data('reactomeId') === event.dbId);
        return exitedNodes.length > 0;
    }


    resizeCompartment(node: any, e: any, previousDragPos: Position) {
        // Used to determine the direction
        const nodeId = node.data('id') as string;
        const pos = node.position();
        let deltaX = pos.x - previousDragPos.x;
        let deltaY = pos.y - previousDragPos.y;
        const compartmentId = node.data('compartment');
        const compartment = e.cy.$('#' + compartmentId);
        if (compartment !== undefined && compartment.length > 0) {
            const comp_pos = compartment.position();
            const new_pos = {
                x: comp_pos.x + deltaX / 2.0,
                y: comp_pos.y + deltaY / 2.0
            };
            compartment.position(new_pos);
            if (nodeId.endsWith('_sw') || nodeId.endsWith('_se')) {
                deltaY = -deltaY; // Flip the direction: negative for reduce the height. But the position should be right.
            }
            if (nodeId.endsWith('_ne') || nodeId.endsWith('_se')) {
                deltaX = -deltaX; // Flip the direction: negative for redue the width
            }
            compartment.data('width', compartment.data('width') - deltaX);
            compartment.data('height', compartment.data('height') - deltaY);
            this.updateResizeNodesPosition(compartment, nodeId, e.cy);
            this.ensureTwoLayerCompartment(compartment, nodeId, e.cy);
        }
        previousDragPos.x = node.position().x;
        previousDragPos.y = node.position().y;
    }

    /**
     * Make sure the two layers of compartment are in correct order: i.g. the outter layer is always 
     * out and the inner layer is alway in.
     * @param compartment
     * @param cy 
     */
    private ensureTwoLayerCompartment(compartment: any, 
        resizeNodeId: string,                             
        cy: Core) 
    {
        let compartmentId = compartment.id();
        // The id has two parts: graph id and inner or outer
        let tokens = compartmentId.split('-');
        let isInner = tokens[1] === 'inner';
        let otherId = tokens[0] + '-' + (isInner ? 'outer' : 'inner');
        let other = cy.$('#' + otherId);

        // Figure out which is inner and which is outer
        let inner = undefined;
        let outer = undefined;
        if (isInner) {
            inner = compartment;
            outer = other;
        }
        else {
            inner = other;
            outer = compartment;
        }

        // Nothing needs to be done in case the compartment has only one layer
        if (inner === undefined || outer === undefined ||
            inner.length === 0 || outer.length === 0) // Cytoscape.js actually returns an empty array
            return;

        // inner dimensions
        let i_w = inner.data('width');
        let i_h = inner.data('height');
        let i_p = inner.position();
        let i_x = i_p.x;
        let i_y = i_p.y;
        let i_left_x = i_x - i_w / 2.0;
        let i_bottom_y = i_y - i_h / 2.0;
        let i_right_x = i_x + i_w / 2.0;
        let i_top_y = i_y + i_h / 2.0;
        // outer dimensions
        let o_w = outer.data('width');
        let o_h = outer.data('height');
        let o_x = outer.position().x;
        let o_y = outer.position().y;
        let o_left_x = o_x - o_w / 2.0;
        let o_bottom_x = o_y - o_h / 2.0;
        let o_right_x = o_x + o_w / 2.0;
        let o_top_y = o_y + o_h / 2.0;
        // Make sure the outer is wrapping the inner
        // Here we will check all four edges one by one to avoid permutation
        // Check west
        if (resizeNodeId.endsWith('_nw') || resizeNodeId.endsWith('_sw')) {
            if (o_left_x > i_left_x) {
                const deltaX = o_left_x - i_left_x;
                if (isInner) { // increase
                    o_w += deltaX;
                    o_x -= deltaX / 2.0;
                }
                else { // reduce
                    i_w -= deltaX;
                    i_x += deltaX / 2.0;
                }
            }
        }
        // Check east
        if (resizeNodeId.endsWith('_ne') || resizeNodeId.endsWith('_se')) {
            if (o_right_x < i_right_x) {
                const deltaX = i_right_x - o_right_x;
                if (isInner) {
                    o_w += deltaX;
                    o_x += deltaX / 2.0;
                }
                else {
                    i_w -= deltaX;
                    i_x -= deltaX / 2.0;
                }
            }
        }
        // Check north
        if (resizeNodeId.endsWith('_nw') || resizeNodeId.endsWith('_ne')) {
            if (o_bottom_x > i_bottom_y) {
                const deltaY = o_bottom_x - i_bottom_y;
                if (isInner) { // increase the height
                    o_h += deltaY;
                    o_y -= deltaY / 2.0;
                }
                else {
                    i_h -= deltaY;
                    i_y += deltaY / 2.0;
                }
            }
        }
        // Check south
        if (resizeNodeId.endsWith('_sw') || resizeNodeId.endsWith('_se')) {
            if (o_top_y < i_top_y) {
                const deltaY = i_top_y - o_top_y;
                if (isInner) {
                    o_h += deltaY;
                    o_y += deltaY / 2.0;
                }
                else {
                    i_h -= deltaY;
                    i_y -= deltaY / 2.0;
                }
            }
        }
        if (isInner) {
            outer.position({x: o_x, y: o_y});
            outer.data('width', o_w);
            outer.data('height', o_h);
        }
        else {
            inner.position({x: i_x, y: i_y});
            inner.data('width', i_w);
            inner.data('height', i_h);
        }
    }

    private updateResizeNodesPosition(compartment: any,
        nodeId: string,
        cy: Core
    ) {
        // Need to update other resizing nodes for this compartment
        const compartmentWidth = compartment.data('width');
        const compartmentHeight = compartment.data('height');
        const compartmentPos = compartment.position();
        const compartmentId = compartment.data('id');
        for (let location of this.RESIZE_NODE_LOCATIONS) {
            const resizeNodeId = this.createResizeNodeId(compartmentId, location);
            if (resizeNodeId === nodeId)
                continue;
            const resizeNode = cy.$('#' + resizeNodeId);
            if (resizeNode === undefined) 
                continue; // This should not happen
            const resizeNodePos = this.getResizeNodePosition(location,
                 compartmentPos, 
                 compartmentWidth, 
                 compartmentHeight);
            resizeNode.position(resizeNodePos);
        }
    }

    /**
     * Add resizing widgets as nodes to the compartment so that the user can resize the compartment
     * by dragging these widgets.
     * @param compartment
     */
    enableResizeCompartment(compartment: any,
        diagram: DiagramComponent
    ) {
        // console.debug('Resizing compartment: ', compartment);
        const position : Position = compartment.position();
        const width = compartment.data('width');
        const height = compartment.data('height');
        for (let location of this.RESIZE_NODE_LOCATIONS) {
            let nodePosition: Position = this.getResizeNodePosition(location, position, width, height);
            const nodeData = {
                id: this.createResizeNodeId(compartment.data('id'), location),
                compartment: compartment.data('id'),
                //TODO: To be determined the best size of these nodes
                width: '16px',
                height: '16px',
                displayName: '' // Add this for "Modification" node type to avoid an error!
            };
            const node: NodeDefinition = {
                data: nodeData,
                position: nodePosition,
                //TODO: Will create a new class css for resizing.
                // Borrow nodeAttachment (modification) for the timebeing
                classes: ['Modification', 'resizing']
            };
            diagram.cy.add(node);
        }
    }

    private getResizeNodePosition(location: string, nodePos: Position, nodeWidth: number, nodeHeight: number) {
        let nodePosition: Position = { x: 0, y: 0 };
        // Divided by 2.0 for easy typing
        nodeWidth = nodeWidth / 2.0;
        nodeHeight = nodeHeight / 2.0;
        // Create four nodes at the four corners of this compartment
        // North-west (top-left)
        if (location === 'nw') {
            nodePosition.x = nodePos.x - nodeWidth;
            nodePosition.y = nodePos.y - nodeHeight;
        }
        else if (location === 'ne') {
            nodePosition.x = nodePos.x + nodeWidth;
            nodePosition.y = nodePos.y - nodeHeight;
        }
        else if (location === 'sw') {
            nodePosition.x = nodePos.x - nodeWidth;
            nodePosition.y = nodePos.y + nodeHeight;
        }
        else if (location === 'se') {
            nodePosition.x = nodePos.x + nodeWidth;
            nodePosition.y = nodePos.y + nodeHeight;
        }
        return nodePosition;
    }

    private createResizeNodeId(nodeId: string,
        location: string
    ) {
        return nodeId + "_resize_node_" + location;
    }

    /**
     * Remove resizing widget nodes added to the compartment.
     * @param compartment
     */
    disableResizeCompartment(compartment: any,
            diagram: DiagramComponent
    ) {
        // The ids of these nodes should have the following patterns
        const resize_id = this.createResizeNodeId(compartment.data('id'), '');
        const resizeNodes = diagram.cy.nodes().filter((node: any) => {
            const id = node.data('id') as string;
            return id.startsWith(resize_id);
        });
        if (resizeNodes)
            diagram.cy.remove(resizeNodes);
    }

    /**
     * Remove a node representing a connecting point from the diagram.
     * @param diagram
     * @param element the node to be removed.
     */
    removePoint(element: any) {
        if (!element.isNode()) // Only a node can be removed
            return;
        // Find the HyperEdge this edge belong to
        const hyperEdge = this.id2hyperEdge.get(element.data('reactomeId'));
        if (hyperEdge === undefined)
            return; // Nothing should be done if no HyperEdge here
        hyperEdge.removeNode(element);
    }

    addPoint(renderedPosition: Position,
             element: any
    ) {
        if (!element.isEdge()) // Work for edge only
            return;
        // Find the HyperEdge this edge belong to
        const hyperEdge = this.id2hyperEdge.get(element.data('reactomeId'));
        if (hyperEdge === undefined)
            return; // Nothing should be done if no HyperEdge here
        hyperEdge.insertNode(renderedPosition, element);
    }

    disableEditing(diagram: DiagramComponent) {
        if (this.id2hyperEdge === undefined || this.id2hyperEdge.size === 0)
            return; // Nothing needs to be done
        // Disable node dragging
        diagram.cy.nodes().grabify().panify();
        diagram.cy.nodes('.Compartment').panify();
        this.id2hyperEdge.forEach((hyperEdge, _) => {
            hyperEdge.enableRoundSegments();
        });
        this.id2hyperEdge.clear(); // Reset it
    }

    enableEditing(diagram: DiagramComponent) {
        // Enable node dragging first
        diagram.cy.nodes().grabify().unpanify();
        // But not compartment
        //TODO: In the editing mode, the user can move compartment too
        // diagram.cy.nodes('.Compartment').panify();
        // Get the position of nodes to be used for edges
        const id2node = new Map<string, any>();
        diagram.cy.nodes().forEach((node: any) => id2node.set(node.data('id'), node));
        const id2edges = new Map<number, any[]>();
        diagram.cy.edges().forEach((edge: any) => {
            const id = edge.data('reactomeId');
            id2edges.set(id, [...(id2edges.get(id) || []), edge]);
        });
        this.id2hyperEdge.clear();
        id2edges.forEach((edges, id) => {
            // convert all edges for a reaction into an HyperEdge object for easy editing
            const hyperEdge: HyperEdge = new HyperEdge(this, diagram.cy, id);
            hyperEdge.expandEdges(edges, id2node);
            this.id2hyperEdge.set(id, hyperEdge);
        });
        // Make sure all round-segments have been converted for editing
        diagram.cy.edges().forEach((edge: any) => {
            let curveStyle = edge.style('curve-style');
            if (curveStyle === 'round-segments') {
                const edgeData = this.copyData(edge.data());
                edgeData.curveStyle = 'segments';
                const edgeCopy: EdgeDefinition = {
                    data: edgeData,
                    classes: edge.classes()
                }
                diagram.cy.remove(edge);
                diagram.cy.add(edgeCopy);
            }
        });
        // Call this to make sure all new edges can be flagged for sub-pathways if any
        diagram.flag([], diagram.cy);
    }

    positionsFromRelativeToAbsolute(edge: any,
        id2node: Map<string, any>
    ) {
        // Get distances and weights first
        let distances = edge.data('distances');
        if (distances === undefined || distances.length === 0)
            return undefined;
        distances = distances.split(" ");
        if (!Array.isArray(distances))
            distances = [distances];
        let weights = edge.data('weights').split(" ");
        if (!Array.isArray(weights))
            weights = [weights]

        // Get the source and target coordinates
        const sourcePos = id2node.get(edge.data('source')).position();
        const sourceEndpoint = edge.data('sourceEndpoint').split(' ');
        const fromPos = {
            x: +sourceEndpoint[0] + sourcePos.x,
            y: +sourceEndpoint[1] + sourcePos.y
        }
        const targetPos = id2node.get(edge.data('target')).position();
        const targetEndpoint = edge.data('targetEndpoint').split(' ');
        const toPos = {
            x: +targetEndpoint[0] + targetPos.x,
            y: +targetEndpoint[1] + targetPos.y
        }

        const poses: Position[] = this.relativeToAbsolute(fromPos,
            toPos, distances, weights
        );
        return poses;
    }

    /**
     * Convert from the relative positions to the absolute positions. This is basically
     * the reverse of method, absoluteToRelative(), in DiagramService, originally implemented
     * by Eliot and Chuqiao.
     * @param source
     * @param target 
     * @param distances 
     * @param weights 
     */
    private relativeToAbsolute(source: Position,
        target: Position,
        distances: number[],
        weights: number[]): Position[] {
        const mainVector = array([target.x - source.x, target.y - source.y]); // Edge vector
        const orthoVector = array([-mainVector.y, mainVector.x]) // Perpendicular vector
            .normalize(); //Normalized to have the distance expressed in pixels https://math.stackexchange.com/a/413235/683621
        let transform = array([
            [mainVector.x, mainVector.y],
            [orthoVector.x, orthoVector.y],
        ]); // Instead of using inv as in the original Eliot's method, the original transform should be used here.

        const absolutePositions = [];
        for (let i = 0; i < distances.length; i++) {
            // Make sure weight first
            const relPos = array([[weights[i], distances[i]]]);
            const absPos = relPos.multiply(transform);
            // Need to convert it into integers for comparison
            const position = {
                x: Math.round(absPos.get(0, 0) + source.x),
                y: Math.round(absPos.get(0, 1) + source.y)
            }
            // Force it to be integer
            absolutePositions.push(position);
        }
        return absolutePositions;
    }

    /**
     * Copied directly from diagram.service.ts to avoid changing the code there.
     * @param source
     * @param target 
     * @param toConvert 
     * @returns 
     */
    absoluteToRelative(source: Position, target: Position, toConvert: Position[]) {
        const distances = [];
        const weights = [];
        const mainVector = array([target.x - source.x, target.y - source.y]); // Edge vector
        const orthoVector = array([-mainVector.y, mainVector.x]) // Perpendicular vector
          .normalize(); //Normalized to have the distance expressed in pixels https://math.stackexchange.com/a/413235/683621
        let transform = array([
          [mainVector.x, mainVector.y],
          [orthoVector.x, orthoVector.y],
        ]).inv(); // Should always be invertible if the ortho vector is indeed perpendicular
    
        for (let coord of toConvert) {
          const absolute = array([[coord.x - source.x, coord.y - source.y]]);
          const relative = absolute.multiply(transform);
          weights.push(relative.get(0, 0))
          distances.push(relative.get(0, 1))
        }
        return {distances: distances, weights: weights};
    }

    copyData(data: any): any {
        // Filter out undefined values from the edge data
        const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined));
        // Stringify the filtered data
        const jsonString = JSON.stringify(filteredData);
        const dataCopy = JSON.parse(jsonString);
        return dataCopy;
    }
}
