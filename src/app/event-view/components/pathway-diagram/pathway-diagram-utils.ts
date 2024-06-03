import { DiagramComponent, DiagramService } from "ngx-reactome-diagram";
import { EdgeDefinition, NodeDefinition, Core } from 'cytoscape';
import { array } from 'vectorious';
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { Injectable } from "@angular/core";
import { first } from "rxjs";

@Injectable()
export class PathwayDiagramUtilService {

    constructor() { }

    enableEditing(diagram: DiagramComponent) {
        // Get the position of nodes to be used for edges
        const id2node = new Map<string, any>();
        diagram.cy.nodes().forEach((node: any) => id2node.set(node.data('id'), node));
        const id2edges = new Map<number, any[]>();
        diagram.cy.edges().forEach((edge: any) => {
            const id = edge.data('reactionId');
            id2edges.set(id, [...(id2edges.get(id) || []), edge]);
        });
        const id2hyperEdges = new Map<number, HyperEdge>();
        id2edges.forEach((edges, id) => {
            // convert all edges for a reaction into an HyperEdge object for easy editing
            let hyperEdge: HyperEdge = new HyperEdge(this, diagram.cy);
            hyperEdge.expandEdges(edges, id2node, diagram.getDiagramService());
            id2hyperEdges.set(id, hyperEdge);
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

    copyData(data: any): any {
        // Filter out undefined values from the edge data
        const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined));
        // Stringify the filtered data
        const jsonString = JSON.stringify(filteredData);
        const dataCopy = JSON.parse(jsonString);
        return dataCopy;
    }

}

/**
 * Model a list of edges that form a HyperEdge. Here, we model this HyperEdge as a simple graph
 * for easy editing.
 */
class HyperEdge {

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

    expandEdges(currentEdges: any[],
        id2node: Map<string, any>,
        diagramServive: DiagramService
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
                let nodeId = edgeData.reactomeId + ":" + point.x + "_" + point.y;
                let pointNode : NodeDefinition = this.id2objects.get(nodeId);
                if (pointNode === undefined) {
                    let data = this.utils.copyData(edgeData);
                    data.id = nodeId;
                    pointNode = {
                        group: 'nodes', // Make sure this is defined
                        data: data,
                        position: {x: point.x, y: point.y},
                        // TODO: Make sure this is what we need
                        classes: ['reaction', 'input_output'] 
                    }
                    this.cy.add(pointNode);
                    this.id2objects.set(nodeId, pointNode);
                }
                target = nodeId;
                // Use input for any internal edges to avoid show arrows.
                let newEdge = this.createNewEdge(source, target, edgeData, diagramServive.edgeTypeMap.get("INPUT"));
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
        this.cy.add(edge);
        this.id2objects.set(newEdgeId, edge);
        return edge;
    }
}