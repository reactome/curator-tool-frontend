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
    // Use to breakdown a long display name
    private readonly WORD_WRAP_RE = /([\ /,:;-])/;
    // private readonly WORD_WRAP_RE_G = /([\ /,:;-])/g;
    // Get from Java desktop version
    private readonly DEFAULT_NODE_WIDTH: number = 130;
    private readonly MIN_NODE_WIDTH: number = 10;
    private readonly WIDTH_RATIO_OF_BOUNDS_TO_TEXT: number = 1.3;
    private readonly HEIGHT_RATIO_OF_BOUNDS_TO_TEXT: number = 1.5;
    private readonly NODE_BOUND_PADDING = 10;
    // Since complex has some decoration, we need to assign a mini height. Otherwise, the decoration
    // may be off.
    private readonly COMPLEX_MIN_HEIGHT = 50;

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
        const inputStoichiometry = new Map<any, number>();
        if (inputs) {
            for (let input of inputs) {
                const inputNode = this.createPENode(input, cy, hyperEdge, utils.diagramService!);
                inputStoichiometry.set(inputNode, (inputStoichiometry.get(inputNode) || 0) + 1);
            }
        }
        // Create output nodes
        const outputs = instance.attributes.get('output');
        const outputStoichiometry = new Map<any, number>();
        if (outputs) {
            for (let output of outputs) {
                const outputNode = this.createPENode(output, cy, hyperEdge, utils.diagramService!);
                outputStoichiometry.set(outputNode, (outputStoichiometry.get(outputNode) || 0) + 1);
            }
        }
        // Catalysts
        const cas = instance.attributes.get('catalyst');
        const catalystNodes = [];
        if (cas) {
            for (let catalyst of cas) {
                const catalystNode = this.createPENode(catalyst, cy, hyperEdge, utils.diagramService!);
                catalystNodes.push(catalystNode);
            }
        }
        // Handle activators
        const activators = instance.attributes.get('activator');
        const activatorNodes = [];
        if (activators) {
            for (let activator of activators) {
                const activatorNode = this.createPENode(activator, cy, hyperEdge, utils.diagramService!);
                activatorNodes.push(activatorNode);
            }
        }
        // inhibitors
        const inhibitors = instance.attributes.get('inhibitor');
        const inhibitorNodes = [];
        if (inhibitors) {
            for (let inhibitor of inhibitors) {
                const inhibitorNode = this.createPENode(inhibitor, cy, hyperEdge, utils.diagramService!);
                inhibitorNodes.push(inhibitorNode);
            }
        }
        // Create a reaction node
        const reactionNode = this.createReactionNode(instance, utils, cy);
        hyperEdge.registerObject(reactionNode);
        // Create edges
        // See if we need an input hub node
        let inputHubNode: any = undefined;
        if (inputStoichiometry.size > 1) {
            inputHubNode = this.createHubNode(instance, cy, 'input');
            hyperEdge.registerObject(inputHubNode);
            // Create an edge from inputHubNode to reactionNode
            const edge = this.createEdge(inputHubNode, reactionNode, instance, 'INPUT', utils, cy);
            hyperEdge.registerObject(edge);
            // Update the id
            edge.classes(['reaction', 'input']); // reset it
        }
        // Create edges
        inputStoichiometry.forEach((stoichiometry, inputNode) => {
            let edge = undefined;
            if (inputHubNode !== undefined)
                edge = this.createEdge(inputNode, inputHubNode, instance, 'INPUT', utils, cy);
            else 
                edge = this.createEdge(inputNode, reactionNode, instance, 'INPUT', utils, cy);
            edge.data('stoichiometry', stoichiometry);
            hyperEdge.registerObject(edge);
        });
        // Handle outputs
        let outputHubNode: any = undefined;
        if (outputStoichiometry.size > 1) {
            outputHubNode = this.createHubNode(instance, cy, 'output');
            const edge = this.createEdge(reactionNode, outputHubNode, instance, 'OUTPUT', utils, cy);
            edge.classes(['reaction', 'output']);
            hyperEdge.registerObject(outputHubNode);
            hyperEdge.registerObject(edge);
        }
        outputStoichiometry.forEach((stoichiometry, outputNode) => {
            let edge = undefined;
            if (outputHubNode !== undefined)
                edge = this.createEdge(outputHubNode, outputNode, instance, 'OUTPUT', utils, cy);
            else
                edge = this.createEdge(reactionNode, outputNode, instance, 'OUTPUT', utils, cy);
            edge.data('stoichiometry', stoichiometry);
            hyperEdge.registerObject(edge);
        })
        // create edges to catalysts
        for (let catalystNode of catalystNodes) {
            const edge = this.createEdge(catalystNode, reactionNode, instance, 'CATALYST', utils, cy);
            hyperEdge.registerObject(edge);
        }
        for (let activatorNode of activatorNodes) {
            const edge = this.createEdge(activatorNode, reactionNode, instance, 'ACTIVATOR', utils, cy);
            hyperEdge.registerObject(edge);
        }
        for (let inhibitorNode of inhibitorNodes) {
            const edge = this.createEdge(inhibitorNode, reactionNode, instance, 'INHIBITOR', utils, cy);
            hyperEdge.registerObject(edge);
        }
        const newNodes = [...inputStoichiometry.keys(), ...outputStoichiometry.keys(), 
            ...catalystNodes, 
            ...activatorNodes,
            ...inhibitorNodes,
            reactionNode]
        if (inputHubNode !== undefined)
            newNodes.push(inputHubNode);
        if (outputHubNode !== undefined)
            newNodes.push(outputHubNode);
        const collection = cy.collection(newNodes);
        // Need to set up the boundingBox to get a better layout
        collection.layout({ name: 'cose', animate: false, boundingBox: { x1: 100, y1: 100, w: 300, h: 300 } }).run();
        // De-select whatever
        cy.$(':selected').unselect();
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
                    stId: instance.dbId + ''
                }
            },
            classes: ['reaction', 'input_output']
        };
        return cy.add(node)[0];
    }

    // TODO: How to calculate the size of the node to wrap all text?
    private createPENode(pe: Instance, cy: Core, hyperedge: HyperEdge, service: DiagramService) {
        const id = pe.dbId + '';
        // Check if this node has been created already
        // In the old pathway diagram, PE nodes have their own ids based on the order
        // To make it backward compatible, we do the search like this
        let exitedNode = cy.nodes().filter(node => node.data('reactomeId') === pe.dbId);
        if (exitedNode.length > 0) { // Always returns something
            // Just register it regardless it has been registered before.
            // Let hyperedge handle duplication
            hyperedge.registerObject(exitedNode[0]);
            return exitedNode[0];
        }
        // This is kind of arbitray
        const node : NodeDefinition = {
            data: {
                id: id,
                reactomeId: pe.dbId,
                displayName: pe.displayName, // Set the name temporarily
                width: this.DEFAULT_NODE_WIDTH, // both width and height will be updated.
                height: 50,
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
        const font = this.getFontStyle(newNode);
        const {label, width, height} = this.getNodeLabelAndDimensions(pe, 
                                                                      font, 
                                                                      this.DEFAULT_NODE_WIDTH);
        newNode.data('width', width);
        newNode.data('height', height);
        newNode.data('displayName', label);
        service.nodeTypeMap.get(this.getNodeType(pe)).forEach((cls: string) => newNode.addClass(cls));
        if (pe.schemaClassName === "RNADrug")
            newNode.addClass("drug");
        hyperedge.registerObject(newNode);
        return newNode;
    }

    private generateRenderableName(displayName: string) {
        // Get rid of the compartment name
        const index = displayName.lastIndexOf('[');
        if (index > 0) {
            displayName = displayName.substring(0, index).trim();
        }
        // By adding \u200b, cytoscape.js will break the labels there (some of them)
        // However, we'd like to have a fine control, therefore, we break up the display name
        // by ourselves.
        // displayName = displayName.replace(this.WORD_WRAP_RE_G, "$1\u200b");
        return displayName;
    }

    /**
     * This is based on the Java version: For EWAS, the node type is determined by
     * its refType, which is provided by the server side code.
     * @param pe 
     */
    private getNodeType(pe: Instance): string {
        const schemaClass = pe.schemaClassName;
        if (schemaClass === "SimpleEntity")
            return "Chemical";
        if (schemaClass === "RNADrug")
            return "RNA"; // For the time being
        if (schemaClass === "EntityWithAccessionedSequence") {
            // Suppose attributes should be a map. Here we are lazy: have not transferred it 
            // when query the server.
            let refSchemaClass = undefined;
            if (pe.attributes)
                refSchemaClass = pe.attributes["refSchemaClass"];
            if (refSchemaClass) {
                if (refSchemaClass === "ReferenceGeneProduct")
                    return "Protein";
                if (refSchemaClass === "ReferenceDNASequence")
                    return "Gene";
                if (refSchemaClass === "ReferenceRNASequence")
                    return "RNA";
            }
            return "Entity";
        }
        if (schemaClass === 'DefinedSet' || schemaClass === 'CandidateSet')
            return "EntitySet";
        return schemaClass;
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

    private measureTextWidth(text: string, font: string): number {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas context not available');
        }
        context.font = font;
        return context.measureText(text).width;
    }
    
    private measureTextHeight(font: string): number {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas context not available');
        }
        context.font = font;
        const metrics = context.measureText('M'); // Use 'M' to approximate the height
        return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    }
    
    private breakTextIntoLines(text: string, font: string, maxWidth: number): { lines: string[], width: number, height: number } {
        const words = text.split(this.WORD_WRAP_RE);
        const lines: string[] = [];
        let currentLine = words[0];
        let maxLineWidth = 0;
    
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.measureTextWidth(currentLine + word, font);
            if (width < maxWidth) {
                currentLine += word;
            } else {
                lines.push(currentLine);
                maxLineWidth = Math.max(maxLineWidth, this.measureTextWidth(currentLine, font));
                currentLine = word;
            }
        }
        lines.push(currentLine);
        maxLineWidth = Math.max(maxLineWidth, this.measureTextWidth(currentLine, font));
    
        const lineHeight = this.measureTextHeight(font);
        const totalHeight = lines.length * lineHeight;
    
        return { lines, width: maxLineWidth, height: totalHeight };
    }
    
    private getNodeLabelAndDimensions(pe: Instance, font: string, maxWidth: number): { label: string, width: number, height: number } {
        const text = this.generateRenderableName(pe.displayName!);
        let { lines, width, height } = this.breakTextIntoLines(text, font, maxWidth);
        // The following code is modified from Java curator tool codebase: Node.initBounds(Graphics)
        width = width * this.WIDTH_RATIO_OF_BOUNDS_TO_TEXT + this.NODE_BOUND_PADDING;
        if (width < this.MIN_NODE_WIDTH)
            width = this.MIN_NODE_WIDTH;
        height = height * this.HEIGHT_RATIO_OF_BOUNDS_TO_TEXT + this.NODE_BOUND_PADDING;
        if (pe.schemaClassName === 'Complex' && height < this.COMPLEX_MIN_HEIGHT)
            height = this.COMPLEX_MIN_HEIGHT;
        const label = lines.join('\n');
        return { label, width, height };
    }

    private getFontStyle(node: any) {
        let fontSize = node.style('font-size');
        let fontFamily = node.style('font-family');
        let fontWeight = node.style('font-weight');
        let fontStyle = node.style('font-style');
        
        // Construct the font style string
        return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    }
    

}