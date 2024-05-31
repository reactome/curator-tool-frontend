import { DiagramComponent, DiagramService } from "ngx-reactome-diagram";
import { EdgeDefinition, NodeDefinition } from 'cytoscape';
import { array } from 'vectorious';
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { Injectable } from "@angular/core";

@Injectable()
export class PathwayDiagramUtilService {

    constructor() { }

    enableEditing(diagram: DiagramComponent) {
        const diagramService: DiagramService = diagram.getDiagramService();
        // diagram.cy.edges().style('curve-style', 'segments');
        // diagram.cy.edges().forEach((edge: any) => {
        //   let curveStyle = edge.style('curve-style');
        //   if (curveStyle === 'round-segments')
        //     edge.style('curve-style', 'segments');
        // });
        // Get the position of nodes to be used for edges
        const id2node = new Map<string, any>();
        diagram.cy.nodes().forEach((node: any) => id2node.set(node.data('id'), node));
        const id2edges = new Map<number, any[]>();
        diagram.cy.edges().forEach((edge: any) => {
            const id = edge.data('reactionId');
            id2edges.set(id, [...(id2edges.get(id) || []), edge]);
        });
        id2edges.forEach((edges, id) => {
            // Do a sorting
            let inputs = [];
            let outputs = [];
            for (let edge of edges) {
                const classes = edge.classes();
                if (classes.includes('incoming') && classes.includes('consumption') && classes.includes('reaction'))
                    inputs.push(edge);
                else if (classes.includes('outgoing') && classes.includes('reaction'))
                    outputs.push(edge);
            }
            if (inputs.length > 1) {
                // Add a new node to connect these inputs together
                const sharedPos = this.getSharedPosition(inputs, id2node);
                console.debug('Shared position: ' + sharedPos?.x + ', ' + sharedPos?.y);
                // Need to convert id to string
                const reactionNode = id2node.get(id.toString());
                // Need to replace these edges with another set
                if (sharedPos !== undefined) {
                    // Add a new input node
                    const inputNodeId = id + '_input';
                    let data = JSON.parse(JSON.stringify(reactionNode.data()));
                    data.id = inputNodeId;
                    const inputNode: NodeDefinition = {
                        data: data,
                        position: { x: sharedPos.x, y: sharedPos.y },
                        style: {
                            width: 10,
                            height: 10
                        },
                        // Use this for the time being
                        classes: diagramService.reactionTypeMap.get('transition')
                    };
                    diagram.cy.add(inputNode);

                    // This input node should be linked to the reaction node
                    data = JSON.parse(JSON.stringify(reactionNode.data()));
                    data.id = id + '_input_reaction';
                    data.source = inputNodeId;
                    data.target = reactionNode.data('id');
                    const inputNode2ReactionEdge: EdgeDefinition = {
                        data: data,
                        classes: diagramService.edgeTypeMap.get('INPUT')
                    };
                    diagram.cy.add(inputNode2ReactionEdge);

                    for (let edge of inputs) {
                        const data = edge.data();
                        data.target = inputNodeId;
                        // We don't need these two fields
                        delete data.weights;
                        delete data.distances;
                        // We want to keep the connecting positions flexiable
                        delete data.sourceEndpoint;
                        delete data.targetEndpoint;
                        const newEdge: EdgeDefinition = {
                            data: data,
                            classes: edge.classes(),
                            selectable: true
                        }
                        diagram.cy.remove(edge);
                        diagram.cy.add(newEdge);
                    }
                }
            }
            if (outputs.length > 1) {
                // Add a new node to connect these outputs together
            }
        });
    }

    private getSharedPosition(edges: any[],
        id2node: Map<string, any>): Position | undefined {
        const listOfPoses: Position[][] = []
        for (let edge of edges) {
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
            let distances = edge.data('distances');
            if (!Array.isArray(distances))
                distances = [distances];
            let weights = edge.data('weights');
            if (!Array.isArray(weights))
                weights = [weights]
            const poses: Position[] = this.relativeToAbsolute(fromPos,
                toPos, distances, weights
            );
            listOfPoses.push(poses);
        }
        return this.findSharedPosition(listOfPoses);
    }

    private findSharedPosition(list: Position[][]): Position | undefined {
        if (list.length === 0) {
            return undefined;
        }

        let sharedPositions = list[0];
        for (let i = 1; i < list.length; i++) {
            sharedPositions = [...sharedPositions].filter(pos => this.hasPosition(pos, list[i]));
        }

        return sharedPositions.length > 0 ? sharedPositions[0] : undefined;
    }

    private hasPosition(pos: Position, list: Position[]): boolean {
        for (let position of list) {
            if (pos.x === position.x && pos.y === position.y)
                return true;
        }
        return false;
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
}