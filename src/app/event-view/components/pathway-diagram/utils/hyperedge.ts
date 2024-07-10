import { EdgeDefinition, NodeDefinition, Core } from "cytoscape";
import { PathwayDiagramUtilService } from "./pathway-diagram-utils";
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { InstanceConverter } from "./instance-converter";

/**
 * Model a list of edges that form a HyperEdge. Here, we model this HyperEdge as a simple graph
 * for easy editing.
 */
export class HyperEdge {

    private utils: PathwayDiagramUtilService;
    private cy: Core;
    // Cached newly created nodes and edges to avoid duplication here
    // Note: This map contains both edges and also newly created nodes.
    private id2objects: Map<string, any> = new Map<string, any>();

    constructor(utils: PathwayDiagramUtilService,
        cy: Core
    ) {
        this.utils = utils;
        this.cy = cy;
    }

    /**
     * Enable round-segment style for this HyperEdge. 
     * Some edges and nodes will be removed. 
     */
    enableRoundSegments() {
        // Find the reaction node first
        // Create round-segment from nodes to reaction node
        let reactionNode = this.getReactionNode();
        if (reactionNode === undefined)
            return; // Nothing needs to be done
        console.debug('Found reaction node: ', reactionNode);
        // Use aStart function to find the paths. dfs and bfs apparently cannot work!
        const collection = this.cy.collection(Array.from(this.id2objects.values()));
        const toBeRemoved = new Set<any>();
        for (let elm of this.id2objects.values()) {
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

    private createRoundSegmentEdgeForPath(path: any, toBeRemoved: Set<any>) {
        // If the path distance is 1, the edge is a line. Nothing to work on it.
        if (!path.found || path.distance === 1) return; // Nothing can or need to be done
        const rxtNode: any = path.path[0];
        const peNode: any = path.path[path.path.length - 1];
        if (!peNode.isNode()) 
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
            source = rxtNode;
            target = peNode;
            edgeClasses = lastEdge.classes();
        }
        else {
            data = this.utils.copyData(firstEdge.data());
            source = peNode;
            target = rxtNode;
            edgeClasses = firstEdge.classes();
            points = points.reverse();
        }
        data.source = source.data('id');
        data.target = target.data('id');
        const edgeTypeText = " --" + this.utils.diagramService?.edgeTypeToStr.get(edgeType) + " ";
        let newEdgeId = data.source + edgeTypeText + data.target;
        newEdgeId = this.getNewEdgeId(newEdgeId);
        data.id = newEdgeId;
        const relPos = this.utils.absoluteToRelative(source.position(), 
                                              target.position(),
                                              points);
        data.weights = relPos.weights.join(" ");
        data.distances = relPos.distances.join(" ");
        data.curveStyle = "round-segments";
        data.sourceEndpoint = '0 0';
        data.targetEndpoint = '0 0';
        const edge: EdgeDefinition = {
            data: data,
            classes: [...edgeClasses],
        };
        this.cy.add(edge);
    }

    private getNewEdgeId(id: string) {
        if (!this.id2objects.has(id)) return id;
        let count = 1;
        while (this.id2objects.has(id)) {
            id = id + "_" + count;
        }
        return id;
    }

    private getEdgeType(edge: any): string {
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
        if (element.hasClass('reaction') && !element.hasClass('input_output'))
            return true;
        return false;
    }

    expandEdges(currentEdges: any[],
        id2node: Map<string, any>
    ) {
        this.id2objects = new Map<string, any>();
        for (let edge of currentEdges) {
            // Cache nodes first
            this.id2objects.set(edge.source().data('id'), edge.source());
            this.id2objects.set(edge.target().data('id'), edge.target());
            const points = this.utils.positionsFromRelativeToAbsolute(edge, id2node);
            if (points === undefined || points.length === 0) {
                this.id2objects.set(edge.data('id'), edge);
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
        let pointNode: NodeDefinition = this.id2objects.get(nodeId);
        if (pointNode === undefined) {
            let data = this.utils.copyData(edgeData);
            data.id = nodeId;
            pointNode = {
                group: 'nodes', // Make sure this is defined
                data: data,
                // position: { x: point.x, y: point.y },
                // TODO: Make sure this is what we need
                classes: ['reaction', 'input_output']
            };
            const newNode = this.cy.add(pointNode)[0];
            if (isRenderedPosition)
                newNode.renderedPosition(point as any);
            else
                newNode.position(point);
            this.id2objects.set(nodeId, newNode);
        }
        return nodeId;
    }

    /**
     * Make sure the trvial list is correct.
     */
    private resetTrivial() {
        // Remove trivial from all edges first
        this.id2objects.forEach((element, id) => {
            if (element.isEdge() && element.hasClass('trivial')) {
                element.removeClass('trivial');
            }
        })
        // Now we want to add trivial back for whatever is needed
        let isChanged = true;
        //TODO: This has not done yet. Also need to check input_output nodes and 
        // edges links between input_output nodes and trivial nodes
        // Will wait for new classes.
        while (isChanged) {
            isChanged = false;
            this.id2objects.forEach((element, id) => {
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
                else if (element.isNode() && element.hasClass('input_output') && !element.hasClass('trivial')) {
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
                        // If this edge connected to another input_output
                        const connectedNodes = noTrivialEdge.connectedNodes();
                        for (let node of connectedNodes) {
                            if (node === element)
                                continue;
                            if (node.hasClass('input_output')) {
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
        if (this.id2objects.has(newEdgeId)) // Make sure no duplicated eges
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
        this.id2objects.set(newEdgeId, newEdge);
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
        // Split the original edge as two: Use INPUT so that no arrow will show
        this.createNewEdge(srcId, pointNodeId, edge.data(), this.utils.diagramService!.edgeTypeMap.get("INPUT"))
        this.createNewEdge(pointNodeId, targetId, edge.data(), this.utils.diagramService!.edgeTypeMap.get("INPUT"))
        this.cy.remove(edge);
        this.id2objects.delete(edge.data('id'));
    }

    /**
     * Remove a node from this HyperEdge. Only input_output node can be removed.
     * @param node 
     */
    removeNode(node: any) {
        if (!node.hasClass('input_output') || !node.hasClass('reaction'))
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
        const newEdge = this.createNewEdge(inputEdge.source().data('id'),
                                           outputEdge.target().data('id'),
                                           inputEdge.data(),
                                           inputEdge.classes());
        this.cy.remove(node);
        for (let edge of connectedEdges) {
            this.cy.remove(edge);
            this.id2objects.delete(edge.data('id'));
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

    /**
     * Register a cytoscape.js element (node or edge).
     * @param object
     */
    registerObject(object: any) {
        this.id2objects.set(object.id(), object);
    }

    getRegisteredObject(id: string) {
        return this.id2objects.get(id);
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
        for (let elm of this.id2objects.values()) {
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
        for (let elm of this.id2objects.values()) {
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
        for (let node of this.id2objects.values()) {
            if (this.isReactionNode(node)) {
                reactionNode = node;
                break;
            }
        }
        return reactionNode;
    }

}