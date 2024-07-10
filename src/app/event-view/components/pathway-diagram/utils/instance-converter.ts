/**
 * This script is used to handle the converting from Instance to data objects needed by cytoscape.js.
 */

import { Instance } from "src/app/core/models/reactome-instance.model";
import { PathwayDiagramUtilService } from "./pathway-diagram-utils";
import { EdgeDefinition, NodeDefinition, Core } from 'cytoscape';
import { DiagramService } from "ngx-reactome-diagram";
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { HyperEdge } from "./hyperedge";

export class InstanceConverter {
    // Get from Java desktop version
    private readonly DEFAULT_NODE_WIDTH: number = 130;
    // This is arbitray
    private readonly INIT_POSITION : Position = {
        x: 50,
        y: 50
    };

    constructor() { }

    /**
     * Convert the instance, which should be a ReactionLikeEvent, into the passed HyperEdge.
     * @param hyperEdge 
     * @param instance 
     * @param utils 
     * @param cy 
     */
    convertReactionToHyperEdge(
        hyperEdge: HyperEdge, 
        instance: Instance,
        utils: PathwayDiagramUtilService,
        cy: Core
    ) {
        // Create input nodes
        const inputs = instance.attributes.get('input');
        const inputNodes = [];
        if (inputs) {
            for (let input of inputs) {
                const inputNode = this.createPENode(input, cy, utils.diagramService!);
                hyperEdge.registerObject(inputNode);
                inputNodes.push(inputNode);
            }
        }
        // Create output nodes
        const outputs = instance.attributes.get('output');
        const outputNodes = [];
        if (outputs) {
            for (let output of outputs) {
                const outputNode = this.createPENode(output, cy, utils.diagramService!);
                hyperEdge.registerObject(outputNode);
                outputNodes.push(outputNode);
            }
        }
        // Catalysts
        const cas = instance.attributes.get('catalyst');
        const catalystNodes = [];
        if (cas) {
            for (let catalyst of cas) {
                const catalystNode = this.createPENode(catalyst, cy, utils.diagramService!);
                hyperEdge.registerObject(catalystNode);
                catalystNodes.push(catalystNode);
            }
        }
        // Create a reaction node
        const reactionNode = this.createReactionNode(instance, utils, cy);
        hyperEdge.registerObject(reactionNode);
        // Create edges
        // See if we need an input hub node
        let inputHubNode = undefined;
        if (inputNodes.length > 1) {
            inputHubNode = this.createHubNode(instance, cy, 'input');
            hyperEdge.registerObject(inputHubNode);
            // Create an edge from inputHubNode to reactionNode
            const edge = this.createEdge(inputHubNode, reactionNode, instance, 'INPUT', utils, cy);
            hyperEdge.registerObject(edge);
            // Update the id
            edge.classes(['reaction', 'input']); // reset it
        }
        // Create edges
        for (let inputNode of inputNodes) {
            let edge = undefined;
            if (inputHubNode !== undefined)
                edge = this.createEdge(inputNode, inputHubNode, instance, 'INPUT', utils, cy);
            else 
                edge = this.createEdge(inputNode, reactionNode, instance, 'INPUT', utils, cy);
            hyperEdge.registerObject(edge);
        }
        // Handle outputs
        let outputHubNode = undefined;
        if (outputNodes.length > 1) {
            outputHubNode = this.createHubNode(instance, cy, 'output');
            const edge = this.createEdge(reactionNode, outputHubNode, instance, 'OUTPUT', utils, cy);
            edge.classes(['reaction', 'output']);
            hyperEdge.registerObject(outputHubNode);
            hyperEdge.registerObject(edge);
        }
        for (let outputNode of outputNodes) {
            let edge = undefined;
            if (outputHubNode !== undefined)
                edge = this.createEdge(outputHubNode, outputNode, instance, 'OUTPUT', utils, cy);
            else
                edge = this.createEdge(reactionNode, outputNode, instance, 'OUTPUT', utils, cy);
            hyperEdge.registerObject(edge);
        }
        // create edges to catalysts
        for (let catalystNode of catalystNodes) {
            const edge = this.createEdge(catalystNode, reactionNode, instance, 'CATALYST', utils, cy);
            hyperEdge.registerObject(edge);
        }
        const newNodes = [...inputNodes, ...outputNodes, ...catalystNodes, reactionNode]
        if (inputHubNode !== undefined)
            newNodes.push(inputHubNode);
        if (outputHubNode !== undefined)
            newNodes.push(outputHubNode);
        const collection = cy.collection(newNodes);
        // Need to set up the boundingBox to get a better layout
        collection.layout({ name: 'cose', animate: false, boundingBox: { x1: 100, y1: 100, w: 300, h: 300 } }).run();
        collection.select();
    }

    private createReactionNode(instance: Instance, utils: PathwayDiagramUtilService, cy: Core) {
        const reactionNodes: NodeDefinition = {
            data: {
                id: 'reaction_' + instance.dbId,
                reactomeId: instance.dbId,
                // displayName: instance.displayName,
                width: 20,
                height: 20,
                graph: {
                    stId: instance.dbId + '',
                },
            },
            position: { x: 50, y: 50 },
            classes: utils.diagramService?.reactionTypeMap.get('transition'),
        };
        const reactionNode = cy.add(reactionNodes)[0];
        return reactionNode;
    }

    private createHubNode(instance: Instance,
        cy: Core,
        type: string // input or output
    ) {
        const nodeId = instance.dbId + "_" + type;
        const node : NodeDefinition = {
            data: {
                id: nodeId,
                reactomeId: instance.dbId,
                graph: {
                    stId: instance.dbId
                }
            },
            classes: ['reaction', 'input_output']
        };
        return cy.add(node)[0];
    }

    private createPENode(pe: Instance, cy: Core, service: DiagramService) {
        // This is kind of arbitray
        const node: NodeDefinition = {
            data: {
                id: pe.dbId + '',
                reactomeId: pe.dbId,
                displayName: pe.displayName,
                width: this.DEFAULT_NODE_WIDTH,
                graph: {
                    stId: pe.dbId + '' // Use reactome id for the time being
                }
            },
            // Have to make a copy
            position: {
                x: this.INIT_POSITION.x,
                y: this.INIT_POSITION.y
            }
        };
        const newNode = cy.add(node)[0];
        const bb = newNode.boundingBox({ includeLabels: true });
        const padding = 20;
        newNode.data('height', bb.h + padding);
        // Assign classes as the last step since we have not assign height previously
        //TODO: To be changed
        service.nodeTypeMap.get('Protein').forEach((cls: string) => newNode.addClass(cls));
        return newNode;
    }

    private createEdge(source: any, 
                       target: any, 
                       instance: Instance,
                       type: string,
                       utils: PathwayDiagramUtilService,
                       cy: Core) {
        const edge: EdgeDefinition = {
            data: {
                id: source.id() + utils.diagramService?.edgeTypeToStr.get(type) + target.id(),
                source: source.id(),
                target: target.id(),
                reactomeId: instance.dbId,
                graph: {
                    stId: instance.dbId + '',
                }
            },
            classes: utils.diagramService?.edgeTypeMap.get(type)
        };
        return cy.add(edge)[0];
    }

}