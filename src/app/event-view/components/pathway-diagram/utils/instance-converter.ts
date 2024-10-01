/**
 * This script is used to handle the converting from Instance to data objects needed by cytoscape.js.
 */

import { Core, EdgeDefinition, NodeDefinition } from 'cytoscape';
import { DiagramService } from "ngx-reactome-diagram";
import { EDGE_POINT_CLASS, Instance, RENDERING_CONSTS } from "src/app/core/models/reactome-instance.model";
import { HyperEdge } from "./hyperedge";
import { PathwayDiagramUtilService } from "./pathway-diagram-utils";
import { Injectable } from '@angular/core';

@Injectable()
export class InstanceConverter {
    
    constructor() { }

    convertCompartmentToNodes(compartment: Instance, 
        utils: PathwayDiagramUtilService,
        cy: Core
    ) {
        // Follow the logic in the Java tool to see if two layers are needed
        const newNodes = [];
        const nodeId = this.getCompartmentNodeId(compartment.dbId, cy);
        if (compartment.displayName?.endsWith('membrane')) {
            const compartmentNode = this.createNodeForInstance(compartment, cy, utils.diagramService!, nodeId);
            // Need to expand the node width
            compartmentNode.data('width', compartmentNode.data('width') * 10);
            compartmentNode.data('height', compartmentNode.data('height') * 10);
            newNodes.push(compartmentNode);
        }
        else {
            // Make sure adding outerNode first so that we can select inner node
            const outerNode = this.createNodeForInstance(compartment, cy, utils.diagramService!, nodeId + '-outer');
            outerNode.addClass('outer');
            // Need to expand the node width
            outerNode.data('width', outerNode.data('width') * 10 + 2 * RENDERING_CONSTS.RECTANGLE_DIST);
            outerNode.data('height', outerNode.data('height') * 10 + 2 * RENDERING_CONSTS.RECTANGLE_DIST);

            // Put the text at the center for the time being
            outerNode.data('textX', -outerNode.data('width') / 2);
            outerNode.data('textY', -outerNode.data('height') / 2);

            outerNode.style('z-index', 0); // Give it a smaller z-index so that we can select the inner one first

            newNodes.push(outerNode);

            const innerNode = this.createNodeForInstance(compartment, cy, utils.diagramService!, nodeId + '-inner');
            innerNode.addClass('inner');
            // Need to expand the node width
            innerNode.data('width', innerNode.data('width') * 10);
            innerNode.data('height', innerNode.data('height') * 10);
            innerNode.style('z-index', 10); // To be selected first
            newNodes.push(innerNode);
        }
        newNodes.forEach(node => this.centerNode(node, cy))
        const collection = cy.collection(newNodes);
        // De-select whatever
        cy.$(':selected').unselect();
        collection.select();
    }

    private getCompartmentNodeId(reactomeId: number, cy: Core) {
        let id = reactomeId + '';
        let node = cy.getElementById(id);
        if (!node || node.length === 0)
            return id;
        let count = 1;
        while (true) {
            id = reactomeId + '_' + count;
            node = cy.getElementById(id);
            if (!node || node.length === 0)
                return id;
            count ++;
        }
    }

    private centerNode(node: any, cy: Core) {
        // Let put it at the center
        let extent = cy.extent();
        let centerX = (extent.x1 + extent.x2) / 2;
        let centerY = (extent.y1 + extent.y2) / 2;
        node.position({
            x: centerX,
            y: centerY
        });
    }

    /**
     * Convert the pathway Instance into a node having process type.
     * @param pathway 
     * @param utils 
     * @param cy 
     */
    convertPathwayToNode(pathway: Instance,
        utils: PathwayDiagramUtilService,
        cy: Core
    ) {
        const processNode = this.createNodeForInstance(pathway, cy, utils.diagramService!);
        this.centerNode(processNode, cy);
        // Need to expand the node width
        processNode.data('width', processNode.data('width') * 1.5);
        processNode.data('height', processNode.data('height') * 1.5);
        const collection = cy.collection([processNode]);
        // De-select whatever
        cy.$(':selected').unselect();
        collection.select();
    }

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
            const edge = this.createEdge(inputHubNode, reactionNode, instance, 'INPUT', utils.diagramService!, cy);
            hyperEdge.registerObject(edge);
            // Update the id
            edge.classes(['reaction', 'input']); // reset it
        }
        // Create edges
        inputStoichiometry.forEach((stoichiometry, inputNode) => {
            let edge = undefined;
            if (inputHubNode !== undefined)
                edge = this.createEdge(inputNode, inputHubNode, instance, 'INPUT', utils.diagramService!, cy);
            else 
                edge = this.createEdge(inputNode, reactionNode, instance, 'INPUT', utils.diagramService!, cy);
            edge.data('stoichiometry', stoichiometry);
            hyperEdge.registerObject(edge);
        });
        // Handle outputs
        let outputHubNode: any = undefined;
        if (outputStoichiometry.size > 1) {
            outputHubNode = this.createHubNode(instance, cy, 'output');
            const edge = this.createEdge(reactionNode, outputHubNode, instance, 'OUTPUT', utils.diagramService!, cy);
            edge.classes(['reaction', 'output']);
            hyperEdge.registerObject(outputHubNode);
            hyperEdge.registerObject(edge);
        }
        outputStoichiometry.forEach((stoichiometry, outputNode) => {
            let edge = undefined;
            if (outputHubNode !== undefined)
                edge = this.createEdge(outputHubNode, outputNode, instance, 'OUTPUT', utils.diagramService!, cy);
            else
                edge = this.createEdge(reactionNode, outputNode, instance, 'OUTPUT', utils.diagramService!, cy);
            edge.data('stoichiometry', stoichiometry);
            hyperEdge.registerObject(edge);
        })
        // create edges to catalysts
        for (let catalystNode of catalystNodes) {
            const edge = this.createEdge(catalystNode, reactionNode, instance, 'CATALYST', utils.diagramService!, cy);
            hyperEdge.registerObject(edge);
        }
        for (let activatorNode of activatorNodes) {
            const edge = this.createEdge(activatorNode, reactionNode, instance, 'ACTIVATOR', utils.diagramService!, cy);
            hyperEdge.registerObject(edge);
        }
        for (let inhibitorNode of inhibitorNodes) {
            const edge = this.createEdge(inhibitorNode, reactionNode, instance, 'INHIBITOR', utils.diagramService!, cy);
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
            // Flag this as an edge point node
            classes: ['reaction', EDGE_POINT_CLASS]
        };
        return cy.add(node)[0];
    }

    // TODO: How to calculate the size of the node to wrap all text?
    createPENode(pe: Instance, cy: Core, hyperedge: HyperEdge | undefined, service: DiagramService) {
        // Check if this node has been created already
        // In the old pathway diagram, PE nodes have their own ids based on the order
        // To make it backward compatible, we do the search like this
        let exitedNode = cy.nodes().filter(node => node.data('reactomeId') === pe.dbId);
        if (exitedNode.length > 0) { // Always returns something
            // Just register it regardless it has been registered before.
            // Let hyperedge handle duplication
            if (hyperedge) // During editing
                hyperedge.registerObject(exitedNode[0]);
            return exitedNode[0];
        }
        // This is kind of arbitray
        const newNode = this.createNodeForInstance(pe, cy, service);
        if (hyperedge)
            hyperedge.registerObject(newNode);
        return newNode;
    }

    private createNodeForInstance(inst: Instance, cy: Core, service: DiagramService, id: string|undefined = undefined) {
        if (!id)
            id = inst.dbId + '';
        const node: NodeDefinition = {
            data: {
                id: id,
                reactomeId: inst.dbId,
                displayName: inst.displayName, // Set the name temporarily
                width: RENDERING_CONSTS.DEFAULT_NODE_WIDTH, // both width and height will be updated.
                height: 50,
                graph: {
                    stId: inst.dbId + '' // Use reactome id for the time being
                }
            },
            // Have to make a copy
            position: {
                x: RENDERING_CONSTS.INIT_POSITION.x,
                y: RENDERING_CONSTS.INIT_POSITION.y
            }
        };
        const newNode = cy.add(node)[0];
        const font = this.getFontStyle(newNode);
        const { label, width, height } = this.getNodeLabelAndDimensions(inst,
            font,
            RENDERING_CONSTS.DEFAULT_NODE_WIDTH);
        newNode.data('width', width);
        newNode.data('height', height);
        newNode.data('displayName', label);
        // Apparent there is no compartment mapping
        if (inst.schemaClassName === 'Compartment')
            newNode.addClass('Compartment');
        else
            service.nodeTypeMap.get(this.getNodeType(inst)).forEach((cls: string) => newNode.addClass(cls));
        if (inst.schemaClassName === "RNADrug")
            newNode.addClass("drug");
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
     * @param inst 
     */
    private getNodeType(inst: Instance): string {
        const schemaClass = inst.schemaClassName;
        if (schemaClass === "SimpleEntity")
            return "Chemical";
        if (schemaClass === "RNADrug")
            return "RNA"; // For the time being
        if (schemaClass === "EntityWithAccessionedSequence") {
            // Suppose attributes should be a map. Here we are lazy: have not transferred it 
            // when query the server.
            let refSchemaClass = undefined;
            if (inst.attributes)
                refSchemaClass = inst.attributes["refSchemaClass"];
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
        if (schemaClass === 'Pathway' || schemaClass === 'CellLineagePath' || schemaClass === 'TopLevelPathway')
            return 'ProcessNode';
        if (schemaClass === 'Compartment')
            return 'Compartment';
        return schemaClass;
    }

    createEdge(source: any,
        target: any,
        instance: Instance,
        type: string,
        digramService: DiagramService,
        cy: Core) {
        const edge: EdgeDefinition = {
            data: {
                id: source.id() + digramService.edgeTypeToStr.get(type) + target.id(),
                source: source.id(),
                target: target.id(),
                reactomeId: instance.dbId,
                graph: {
                    stId: instance.dbId + '',
                }
            },
            classes: digramService.edgeTypeMap.get(type)
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
        const words = text.split(RENDERING_CONSTS.WORD_WRAP_RE);
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
        width = width * RENDERING_CONSTS.WIDTH_RATIO_OF_BOUNDS_TO_TEXT + RENDERING_CONSTS.NODE_BOUND_PADDING;
        if (width < RENDERING_CONSTS.MIN_NODE_WIDTH)
            width = RENDERING_CONSTS.MIN_NODE_WIDTH;
        height = height * RENDERING_CONSTS.HEIGHT_RATIO_OF_BOUNDS_TO_TEXT + RENDERING_CONSTS.NODE_BOUND_PADDING;
        // Need bigger dimensions
        const extra_dim_classes = ['Complex', 'Pathway', 'CellLineagePath', 'TopLevelPathway'];
        if (extra_dim_classes.includes(pe.schemaClassName) && height < RENDERING_CONSTS.COMPLEX_MIN_HEIGHT)
            height = RENDERING_CONSTS.COMPLEX_MIN_HEIGHT;
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