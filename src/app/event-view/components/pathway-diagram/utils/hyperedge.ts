import { Core, EdgeDefinition, NodeDefinition } from "cytoscape";
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { EDGE_POINT_CLASS, Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { InstanceConverter } from "./instance-converter";
import { PathwayDiagramUtilService } from "./pathway-diagram-utils";

/**
 * Model a list of edges that form a HyperEdge. Here, we model this HyperEdge as a simple graph
 * for easy editing.
 */
export class HyperEdge {

    private utils: PathwayDiagramUtilService;
    private cy: Core;
    // Cached newly created nodes and edges to avoid duplication here
    // Note: This map contains both edges and also newly created nodes.
    private id2object: Map<string, any> = new Map<string, any>();
    // Track the reactome id
    private reactomeId: number|string;
    
    constructor(utils: PathwayDiagramUtilService,
        cy: Core,
        reactomeId: number|string,
    ) {
        this.utils = utils;
        this.cy = cy;
        this.reactomeId = reactomeId;
    }

    /**
     * Delete all nodes and edges created for this HyperEdge object.
     */
    delete() {
        this.id2object.forEach((value, key) => {
            if (value.hasClass('PhysicalEntity')) {
                // We cannot just remove an element.
                // Only element linked to objects solely belong to
                // this hyperedge can be removed.
                const connectedEdges = value.connectedEdges();
                // As long as this node is linked to any other edges, including flowline,
                // don't delete it (this may be changed in the future)
                if (connectedEdges && connectedEdges.length > 0)
                    return;
            }
            // Otherwise can be removed safely
            this.cy.remove(value);
        });
        this.id2object.clear();
    }

    /**
     * Enable round-segment style for this HyperEdge. 
     * Some edges and nodes will be removed. 
     */
    enableRoundSegments() {
        if (this.reactomeId?.toString().includes('-')) {
            // This should be a FlowLine: no true Reactome id
            this.enableRoundSegmentsForFlowLine();
            return;
        }
        // Find the reaction node first
        // Create round-segment from nodes to reaction node
        let reactionNode = this.getReactionNode();
        if (reactionNode === undefined)
            return; // Nothing needs to be done
        console.debug('Found reaction node: ', reactionNode);
        // Use aStart function to find the paths. dfs and bfs apparently cannot work!
        const collection = this.cy.collection(Array.from(this.id2object.values()));
        const toBeRemoved = new Set<any>();
        for (let elm of this.id2object.values()) {
            if (elm.isEdge() || elm === reactionNode)
                continue;
            if (!elm.hasClass('PhysicalEntity'))
                continue; // For PE only
            
            let path = collection.aStar({
                root: '#' + reactionNode.data('id'),
                goal: '#' + elm.data('id')
            });
            console.debug(path.path);
            this.createRoundSegmentEdgeForPath(path, toBeRemoved);
        }
        this.cy.remove(this.cy.collection(Array.from(toBeRemoved)));
    }

    /**
     * Basically a simplified version of enableRoundSegments().
     * @returns 
     */
    enableRoundSegmentsForFlowLine() {
        // Use aStart function to find the paths. dfs and bfs apparently cannot work!
        const collection = this.cy.collection(Array.from(this.id2object.values()));
        // Need to figure out the original source and target of this flow line
        let flSource = undefined;
        let flTarget = undefined;
        for (let elm of this.id2object.values()) {
            if (!elm.isEdge())
                continue;
            const source = elm.source();
            if (source.hasClass('PhysicalEntity') || source.hasClass('SUB')) {
                flSource = source;
            }
            const target = elm.target();
            if (target.hasClass('PhysicalEntity') || target.hasClass('SUB')) {
                flTarget = target;
            }
        }
        const toBeRemoved = new Set<any>();
        const path = collection.aStar({
                root: '#' + flSource.data('id'),
                goal: '#' + flTarget.data('id')
            });
        this.createRoundSegmentEdgeForPath(path, toBeRemoved);
        this.cy.remove(this.cy.collection(Array.from(toBeRemoved)));
    }

    private createRoundSegmentEdgeForPath(path: any, toBeRemoved: Set<any>) {
        // If the path distance is 1, the edge is a line. Nothing to work on it.
        if (!path.found || path.distance === 1) return; // Nothing can or need to be done
        const sourceNode: any = path.path[0];
        const targetNode: any = path.path[path.path.length - 1];
        if (!targetNode.isNode()) 
            return; // Work with node only
        let points: Position[] = [];
        let lastEdge = undefined;
        let firstEdge = undefined;
        for (let i = 1; i < path.path.length - 1; i++) { // Path has both nodes and edges
            let element = path.path[i];
            // Mark to be removed
            toBeRemoved.add(element);
            if (element.isNode())
                points.push(element.position());
            else if (element.isEdge()) {
                if (firstEdge === undefined)
                    firstEdge = element;
                lastEdge = element;
            }
        }
        // Use the lastEdge's data for the new edge
        const edgeType = this.getEdgeType(lastEdge);
        let data = undefined;
        let edgeClasses = undefined;
        let source = undefined;
        let target = undefined;
        if (edgeType === "OUTPUT") {
            data = this.utils.copyData(lastEdge.data());
            source = sourceNode;
            target = targetNode;
            edgeClasses = lastEdge.classes();
        }
        else {
            data = this.utils.copyData(firstEdge.data());
            source = targetNode;
            target = sourceNode;
            edgeClasses = firstEdge.classes();
            points = points.reverse();
        }
        data.source = source.data('id');
        data.target = target.data('id');
        const edgeTypeText = " --" + this.utils.diagramService?.edgeTypeToStr.get(edgeType) + " ";
        let newEdgeId = data.source + edgeTypeText + data.target;
        newEdgeId = this.getNewEdgeId(newEdgeId);
        data.id = newEdgeId;
        // Get the target position
        let targetPos = target.position();
        if (edgeType === 'OUTPUT') // Need to get the point around the node bounding box
            targetPos = this.utils.findIntersection(points[points.length - 1], target);
        let sourcePos = source.position();
        if (source.hasClass('PhysicalEntity') || source.hasClass('SUB')) 
            sourcePos = this.utils.findIntersection(points[0], source);
        const relPos = this.utils.absoluteToRelative(sourcePos, targetPos, points);
        data.weights = relPos.weights.join(" ");
        data.distances = relPos.distances.join(" ");
        data.curveStyle = "round-segments";
        data.sourceEndpoint = this.getEndPoint(sourcePos, source);
        data.targetEndpoint = this.getEndPoint(targetPos, target);
        const edge: EdgeDefinition = {
            data: data,
            classes: [...edgeClasses],
        };
        this.cy.add(edge);
    }

    private getEndPoint(intersection: Position, node: any) {
        // Follow the method endpoint() in diagram.service.ts
        return (intersection.x - node.position().x) + ' ' + (intersection.y - node.position().y);
    }

    private getNewEdgeId(id: string) {
        if (!this.id2object.has(id)) return id;
        let count = 1;
        while (this.id2object.has(id)) {
            id = id + "_" + count;
        }
        return id;
    }

    private getEdgeType(edge: any): string {
        if (edge.data('edgeType'))
            return "OUTPUT"; // e.g. flowline
        // Based on the original definition
        if (edge.hasClass('consumption')) return "INPUT";
        if (edge.hasClass('positive-regulation')) return "ACTIVATOR";
        // Cannot map back to "required"
        if (edge.hasClass('negative-regulation')) return "INHIBITOR";
        if (edge.hasClass('catalysis')) return "CATALYST";
        if (edge.hasClass('production')) return "OUTPUT";
        return "UNKNOWN"; // The default
    }

    private isReactionNode(element: any): boolean {
        if (!element.isNode())
            return false;
        if (element.hasClass('reaction') && !element.hasClass(EDGE_POINT_CLASS))
            return true;
        return false;
    }

    expandEdges(currentEdges: any[],
        id2node: Map<string, any>
    ) {
        this.id2object = new Map<string, any>();
        for (let edge of currentEdges) {
            // Cache nodes first
            this.id2object.set(edge.source().data('id'), edge.source());
            this.id2object.set(edge.target().data('id'), edge.target());
            const points = this.utils.positionsFromRelativeToAbsolute(edge, id2node);
            if (points === undefined || points.length === 0) {
                this.id2object.set(edge.data('id'), edge);
                continue;
            }
            // Expand the edges
            const sourceNode = edge.data('source');
            const targetNode = edge.data('target');
            const edgeData = edge.data();
            let source = sourceNode;
            let target = targetNode;
            let firstEdge = undefined;
            for (let point of points) {
                let nodeId = this.createPointNode(edgeData, point);
                target = nodeId;
                // Use input for any internal edges to avoid showing arrows.
                let newEdge = this.createNewEdge(source, target, edgeData, this.utils.diagramService!.edgeTypeMap.get("INPUT"));
                source = target;
                if (!firstEdge) firstEdge = newEdge;
            }
            let lastEdge = this.createNewEdge(source, targetNode, edgeData, edge.classes());
            // A hack to call data
            let newEdge: any = undefined;
            if (edge.classes().includes('consumption'))
                newEdge = firstEdge;
            else if (edge.classes().includes('production'))
                newEdge = lastEdge;
            if (newEdge !== undefined)
                newEdge.data.stoichiometry = edgeData.stoichiometry;
            this.cy.remove(edge);
        }
        this.resetTrivial();
    }

    private createPointNode(edgeData: any, point: Position, isRenderedPosition: boolean = false) {
        let nodeId = edgeData.reactomeId + ":" + point.x + "_" + point.y;
        let pointNode: NodeDefinition = this.id2object.get(nodeId);
        if (pointNode === undefined) {
            let data = this.utils.copyData(edgeData);
            data.id = nodeId;
            pointNode = {
                group: 'nodes', // Make sure this is defined
                data: data,
                // position: { x: point.x, y: point.y },
                // TODO: Make sure this is what we need
                classes: ['reaction', EDGE_POINT_CLASS]
            };
            const newNode = this.cy.add(pointNode)[0];
            if (isRenderedPosition)
                newNode.renderedPosition(point as any);
            else
                newNode.position(point);
            this.id2object.set(nodeId, newNode);
        }
        return nodeId;
    }

    /**
     * Make sure the trvial list is correct.
     */
    private resetTrivial() {
        // Remove trivial from all edges first
        this.id2object.forEach((element, id) => {
            if (element.isEdge() && element.hasClass('trivial')) {
                element.removeClass('trivial');
            }
        })
        // Now we want to add trivial back for whatever is needed
        let isChanged = true;
        //TODO: This has not done yet. Also need to check edge point nodes and 
        // edges links between edge point nodes and trivial nodes
        // Will wait for new classes.
        while (isChanged) {
            isChanged = false;
            this.id2object.forEach((element, id) => {
                if (element.isEdge() && !element.hasClass('trivial')) {
                    const connectedNodes = element.connectedNodes();
                    for (let node of connectedNodes) {
                        if (node.hasClass('trivial')) {
                            element.addClass('trivial');
                            isChanged = true;
                        }
                    }
                }
                // TODO: Need to find use cases for this
                else if (element.isNode() && element.hasClass(EDGE_POINT_CLASS) && !element.hasClass('trivial')) {
                    // Have to check connected edges for a node
                    const connectedEdges = element.connectedEdges();
                    let totalNoTrivialEdge = 0;
                    let noTrivialEdge = undefined;
                    for (let edge of connectedEdges) {
                        if (!edge.hasClass('trivial')) {
                            totalNoTrivialEdge ++;
                            noTrivialEdge = edge;
                        }
                    }
                    if (totalNoTrivialEdge > 1) {
                        return; // Try again late
                    }
                    if (totalNoTrivialEdge === undefined) {
                        element.addClass('trivial');
                        isChanged = true;
                    }
                    else {
                        // If this edge connected to another edge point
                        const connectedNodes = noTrivialEdge.connectedNodes();
                        for (let node of connectedNodes) {
                            if (node === element)
                                continue;
                            if (node.hasClass(EDGE_POINT_CLASS)) {
                                element.addClass('trivial');
                                isChanged = true;
                            }
                        }
                    }
                }
            })
        }
    }


    private createNewEdge(source: any, target: any, edgeData: any, edgeClasses: any) {
        const newEdgeId = source + '--' + target;
        if (this.id2object.has(newEdgeId)) // Make sure no duplicated eges
            return;
        let data = this.utils.copyData(edgeData);
        data.source = source;
        data.target = target;
        data.id = newEdgeId;
        // The new edges should be straigh line
        delete data.distances;
        delete data.weights;
        delete data.sourceEndpoint;
        delete data.targetEndpoint;
        delete data.stoichiometry; // We will add this later on depenends on need
        const edge: EdgeDefinition = {
            data: data,
            classes: [...edgeClasses],
        };
        const newEdge = this.cy.add(edge)[0];
        this.id2object.set(newEdgeId, newEdge);
        return newEdge;
    }

    /**
     * Insert a new node into a HyperEdge
     * @param position
     * @param edge 
     */
    insertNode(renderedPosition: Position, edge: any) {
        const pointNodeId = this.createPointNode(edge.data(), renderedPosition, true);
        const srcId = edge.data('source');
        const targetId = edge.data('target');
        // Split the original edge as two: Use INPUT so that no arrow will show for the first,
        // and the second should take whatever the original edge has
        this.createNewEdge(srcId, pointNodeId, edge.data(), this.utils.diagramService!.edgeTypeMap.get("INPUT"))
        this.createNewEdge(pointNodeId, targetId, edge.data(), edge.classes());
        this.cy.remove(edge);
        this.id2object.delete(edge.data('id'));
    }

    /**
     * Remove a node from this HyperEdge. Only edge point node can be removed.
     * @param node 
     */
    removeNode(node: any) {
        if (!node.hasClass(EDGE_POINT_CLASS) || !node.hasClass('reaction'))
            return;
        const connectedEdges = node.connectedEdges();
        // Don't remove any node that is connected more than two edges: 
        // these are nodes in the reaction backbone.
        // Actually only nodes that are used as connecting can be removed
        // these node should have connection degree == 2.
        if (connectedEdges.length !== 2) 
            return;
        // Find the input edge
        let inputEdge = undefined;
        let outputEdge = undefined;
        for (let edge of connectedEdges) {
            if (edge.source() === node)
                outputEdge = edge;
            else
                inputEdge = edge;
        }
        // Do nothing if either of them cannot be found
        if (inputEdge === undefined || outputEdge === undefined)
            return;
        //TODO: Check if outputEdge or inputEdge data should be used
        // For the time being, use outputEdge (e.g. between input and output)
        const newEdge = this.createNewEdge(inputEdge.source().data('id'),
                                           outputEdge.target().data('id'),
                                           outputEdge.data(),
                                           outputEdge.classes());
        this.cy.remove(node);
        for (let edge of connectedEdges) {
            this.cy.remove(edge);
            this.id2object.delete(edge.data('id'));
        }
    }

    /**
     * Convert an Event Instance to a HyperEdge for editing.
     * @param event
     * @returns 
     */
    createFromEvent(event: Instance, 
                    dataService: DataService,
                    converter: InstanceConverter) {
        console.debug('Converting an Event to HyperEdge: ' + event);
        dataService.fetchReactionParticipants(event.dbId).subscribe((instance: Instance) => {
            converter.convertReactionToHyperEdge(this, instance, this.utils, this.cy);
            // Let put it at the center for the time being
            let extent = this.cy.extent();
            let centerX = (extent.x1 + extent.x2) / 2;
            let centerY = (extent.y1 + extent.y2) / 2;
            this.layout({x: centerX, y: centerY});
        });
    }

    createFlowLine(source: any,
        target: any,
        utils: PathwayDiagramUtilService,
        cy: Core) {
        const edge: EdgeDefinition = {
            data: {
                // Use OUTPUT for edge type
                id: source.id() + utils.diagramService?.edgeTypeToStr.get('OUTPUT') + target.id(),
                source: source.id(),
                target: target.id(),
                // add a new attribute to determine the type of this edge
                edgeType: 'FlowLine',
                // Since we don't have actual Reactome id for this, we will add
                // a new hyperEdge id
                hyperEdgeId: source.dbId + '-' + target.dbId
            },
            classes: utils.diagramService?.linkClassMap.get('FlowLine')
        };
        const flowLine = cy.add(edge)[0];
        this.registerObject(source);
        this.registerObject(target);
        this.registerObject(flowLine);
        return flowLine;
    }

    /**
     * Register a cytoscape.js element (node or edge).
     * @param object
     */
    registerObject(object: any) {
        this.id2object.set(object.id(), object);
    }

    getRegisteredObject(id: string) {
        return this.id2object.get(id);
    }

    /**
     * Layout this HyperEdge in a horizonal way. This layout can be used only for a nascent HyperEdge when no extra
     * points have been added. For HyperEdge having extra points added, use another method. 
     * Note: This method is ported from Java version, https://github.com/reactome/CuratorTool/blob/022fc5a7cfee990f9ee4e3b696a8317f2aa05d36/src/org/gk/render/HyperEdge.java#L71.
     * @param pos 
     */
    layout(pos: Position) {
        const reactionNode = this.getReactionNode();
        if (reactionNode === undefined)
            return; // Nothing to do.
        // Put the reaction node to the passed position
        reactionNode.position({x: pos.x, y: pos.y});
        const inputNodes = this.getNodesForClass('consumption');
        const inputHubNode = this.getHubNode('consumption');
        if (inputHubNode !== reactionNode) {
            inputHubNode.position({
                x: pos.x - 100, // Get this number from Java
                y: pos.y
            });
        }
        
        const w = 75 * 2; // Copied from Java
        if (inputNodes.length > 0) {
            // Half circle so that the inputs can be arranges at the same side
            const div = Math.PI / inputNodes.length;
            const shift = div / 2;
            let x, y;
            let inputHubPos = inputHubNode.position();
            for (let i = 0; i < inputNodes.length; i++) {
                x = w * Math.sin((i + 1) * div - shift);
                y = w * Math.cos((i + 1) * div - shift);
                inputNodes[i].position({
                    x: inputHubPos.x - x,
                    y: inputHubPos.y - y
                });
            }
        }
        
        const outputNodes = this.getNodesForClass('production', true);
        const outputHubNode = this.getHubNode('production');
        if (outputHubNode !== reactionNode) {
            outputHubNode.position({
                x: pos.x + 100,
                y: pos.y
            });
        }
        if (outputNodes.length > 0) {
            // Half circle so that the inputs can be arranges at the same side
            const div = Math.PI / outputNodes.length;
            const shift = div / 2;
            let x, y;
            let outputHubPos = outputHubNode.position();
            for (let i = 0; i < outputNodes.length; i++) {
                x = w * Math.sin((i + 1) * div - shift);
                y = w * Math.cos((i + 1) * div - shift);
                outputNodes[i].position({
                    x: outputHubPos.x + x,
                    y: outputHubPos.y - y
                });
            }
        }

        const accessoryNodes = this.getAccessoryNodes();
        if (accessoryNodes.length > 0) {
            const div = 2 * Math.PI / accessoryNodes.length;
            let x, y;
            for (let i = 0; i < accessoryNodes.length; i++) {
                x = w * Math.sin(i * div);
                y = w * Math.cos(i * div);
                accessoryNodes[i].position({
                    x: pos.x - x,
                    y: pos.y - y
                });
            }
        }
    }

    private getHubNode(role: string) : any {
        for (let elm of this.id2object.values()) {
            if (!elm.isEdge())
                continue;
            if (elm.hasClass(role)) {
                if (role === 'consumption')
                    return elm.target();
                if (role === 'production')
                    return elm.source();
            }
        }
        return undefined;
    }

    private getNodesForClass(cls: string,
        needTarget: boolean = false,
    ): any[] {
        const nodes : any[] = [];
        for (let elm of this.id2object.values()) {
            if (!elm.isEdge())
                continue;
            if (elm.hasClass(cls)) {
                if (needTarget)
                    nodes.push(elm.target());
                else
                    nodes.push(elm.source());
            }
        }
        return nodes;
    }

    /**
     * Get accessory nodes, including catalyst, activators, and inhibitors.
     */
    private getAccessoryNodes(): any[] {
        const catalystNodes = this.getNodesForClass('catalysis');
        const activatorNodes = this.getNodesForClass('positive-regulation');
        const inhibitorNodes = this.getNodesForClass('negative-regulation');
        return [...catalystNodes, ...activatorNodes, ...inhibitorNodes];
    }

    private getReactionNode(): any {
        let reactionNode = undefined;
        for (let node of this.id2object.values()) {
            if (this.isReactionNode(node)) {
                reactionNode = node;
                break;
            }
        }
        return reactionNode;
    }

}