import { DiagramComponent, DiagramService } from "ngx-reactome-diagram";
import { EdgeDefinition, NodeDefinition, Core } from 'cytoscape';
import { array } from 'vectorious';
import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
import { Injectable } from "@angular/core";
import { Instance, RENDERING_CONSTS } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { HyperEdge } from "./hyperedge";
import { InstanceConverter } from "./instance-converter";
import { REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import { PathwayDiagramComponent } from "../pathway-diagram.component";
import { PathwayDiagramValidator } from "./pathway-diagram-validator";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { SelectInstanceDialogService } from "src/app/schema-view/list-instances/components/select-instance-dialog/select-instance-dialog.service";
import { AttributeValue } from "src/app/instance/components/instance-view/instance-table/instance-table.model";

@Injectable()
export class PathwayDiagramUtilService {
    diagramService: DiagramService | undefined = undefined;
    // Cache all converted HyperEdges for easy editing
    id2hyperEdge : Map<number|string, HyperEdge> = new Map();
    // For resizing
    private readonly RESIZE_NODE_LOCATIONS: string[] = ['ne', 'nw', 'se', 'sw'];
    
    constructor(private dataService: DataService,
        private validator: PathwayDiagramValidator,
        private converter: InstanceConverter,
        private instanceUtils: InstanceUtilities,
        private compartmentDialogService: SelectInstanceDialogService // Used to insert a compartment
    ) { }

    getDataService(): DataService {
        return this.dataService;
    }

    handleInstanceEdit(attribute: string|undefined, instance: Instance | undefined, diagram: PathwayDiagramComponent) {
        if (instance === undefined || attribute === undefined)
            return;
        // Need to get the actual instance. The passed instance is just a shell retried from ngrx store
        this.dataService.fetchInstance(instance.dbId).subscribe((instance: Instance) => {
            const hyperEdge = this.id2hyperEdge.get(instance.dbId);
            this.validator.hyperEdge = hyperEdge;
            this.validator.handleInstanceEdit(instance, attribute, diagram?.diagram?.cy);
        });
    }

    handleInstanceReset(resetData: any, diagram: PathwayDiagramComponent) {
        if (!resetData.modifiedAttributes || !resetData.dbId)
            return;
        // Need to get the actual instance. The passed instance is just a shell retried from ngrx store
        this.dataService.fetchInstance(resetData.dbId).subscribe((instance: Instance) => {
            for (let att of resetData.modifiedAttributes) {
                this.validator.hyperEdge = this.id2hyperEdge.get(resetData.dbId);
                this.validator.handleInstanceEdit(instance, att, diagram?.diagram?.cy);
            }
        });
    }

    select(diagram: DiagramComponent, dbId: any) {
        if (diagram === undefined || diagram.cy === undefined)
            return; // Nothing to do if nothing displayed
        let dbIds: any[] = [];
        if (typeof dbId === 'string' && dbId.includes(',')) {
            for (let id of dbId.split(','))
                dbIds.push(Number(id));
        }
        else 
            dbIds = [Number(dbId)];
        // To avoid doing anything from the diagram selection,
        // check if these dbids have been selected already.
        // If true, do nothing. 
        const selectedElements = diagram.cy.$(':selected');
        const selectedDbIds = Array.from(new Set(selectedElements.map((element:any) => element.data('reactomeId'))));
        const areSame = (selectedDbIds.length === dbIds.length && selectedDbIds.every(dbId => dbIds.includes(dbId)));
        if (areSame) // Or nothing to be selected
            return; 
        this.clearSelection(diagram);
        diagram.select(dbIds, diagram.cy);
    }

    isDbIdSelected(diagram: DiagramComponent, dbId: number) {
        if (!diagram.cy)
            return; // Make sure cy exists
        const selectedElements = diagram.cy.$(':selected');
        const selectedDbIds = Array.from(new Set(selectedElements.map((element:any) => element.data('reactomeId'))));
        return selectedDbIds.includes(dbId);
    }    

    clearSelection(diagram: DiagramComponent) {
        if (diagram.cy) {
            diagram.cy.$(':selected').unselect();
            diagram.cy.fit(100);
        }
    }

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

    isPathwayDeletable(pathwayElm: any) {
        const connectedEdges = pathwayElm.connectedEdges();
        if (connectedEdges && connectedEdges.length > 0)
            return false;
        return true;
    }

    deletePathwayNode(pathwayElm: any, diagram: DiagramComponent) {
        diagram.cy.remove(pathwayElm);
    }

    /**
     * Compartments may have two nodes for double layers. Both of them should be deleted.
     * @param compartment 
     * @param diagram 
     */
    deleteCompartment(compartment: any, diagram: DiagramComponent) {
        let { isInner, other } = this.getSiblingCompartment(compartment, diagram.cy);
        diagram.cy.remove(compartment);
        if (other)
            diagram.cy.remove(other);
    }

    /**
     * Insert a new compartment into the diagram.
     * @param diagram 
     */
    insertCompartment(diagram: DiagramComponent) {
        // We will get the needed attribute from the pathway class, which should be loaded
        this.dataService.fetchSchemaClass('Pathway').subscribe(pathway => {
            let compartmentAtt = pathway.attributes?.filter(att => att.name === 'compartment')[0] || undefined;
            if (!compartmentAtt) {
                console.log('Cannot find the compartment attribute in Paathway for insertCompartment')
                return;
            }
            // Make a copy so that we can limit it to a single value selection
            compartmentAtt = {
                ...compartmentAtt,
                cardinality: '1'
            };
            const attributeValue: AttributeValue = {
                attribute: compartmentAtt,
                value: undefined
            };
            const matDialogRef = this.compartmentDialogService.openDialog(attributeValue);
            matDialogRef.afterClosed().subscribe(compartment => {
                if (!compartment || (Array.isArray(compartment) && compartment.length === 0)) // Most likely the dialog is cancelled
                    return;
                // Use the first compartment only
                // TODO: Make sure there is only one compartment is selected
                this.converter.convertCompartmentToNodes(compartment[0], this, diagram.cy);
            });
        });
    }

    // Make sure this works for the following case:
    // 1. Only one element is selected and that element is not this element: one of them is ProcessNode and another is 
    // any PE node
    // 2. Two lements are selected, one of them is this element: one of the is ProcessNode and another is any PE node.
    isFlowLineAddable(element: any, diagramComp: PathwayDiagramComponent): boolean {
        // Only editing component can support adding a flow line.
        if (!diagramComp.isEditing || !element)
            return false;
        const selectedElements = diagramComp.diagram.cy.$(':selected');
        if (selectedElements.length == 1) {
            const selectedElement = selectedElements[0];
            if (selectedElement === element)
                return false; // Basically there is only one selected element, itself
            // Make sure one of them is a ProcessNode
            if (element.classes().includes('SUB') && selectedElement.classes().includes('PhysicalEntity'))
                return true;
            if (selectedElement.classes().includes('SUB') && element.classes().includes('PhysicalEntity'))
                return true;
        }
        else if (selectedElements.length == 2 && selectedElements.includes(element)) {
            const elm1 = selectedElements[0];
            const elm2 = selectedElements[1];
            // Make sure one of them is a ProcessNode
            if (elm1.classes().includes('SUB') && elm2.classes().includes('PhysicalEntity'))
                return true;
            if (elm2.classes().includes('SUB') && elm1.classes().includes('PhysicalEntity'))
                return true;
        }
        return false; // default
    }

    addFlowLine(elementUnderMouse: any, diagramComp: PathwayDiagramComponent) {
        // The follow line will be added from another element to this elementUnderMouse
        // It is supposed all has been checked
        const selectedElement = diagramComp.diagram.cy.$(':selected')[0];
        // Follow the same logic to add a new reaction
        // We need HyperEdge to make the code simplier
        const reactomeId = selectedElement.dbId + '-' + elementUnderMouse.dbId;
        const hyperEdge = new HyperEdge(this, diagramComp.diagram.cy, reactomeId);
        hyperEdge.createFlowLine(selectedElement, elementUnderMouse, this, diagramComp.diagram.cy);
        this.id2hyperEdge.set(reactomeId, hyperEdge);
    }

    deleteHyperEdge(element: any) {
        if (!element) return; 
        const dbId = this.getHyperEdgeId(element);
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
        if (REACTION_TYPES.includes(event.schemaClassName)) {
            // For threading issue, we have to do like this way instead of creating an HyperEdge directly by converter.
            const hyperEdge = new HyperEdge(this, cy, event.dbId);
            hyperEdge.createFromEvent(event, this.dataService, this.converter);
            this.id2hyperEdge.set(event.dbId, hyperEdge);
        }
        // Handle pathway
        else {
            // Add as a process node
            this.converter.convertPathwayToNode(event, this, cy);
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

    moveModifications(node: any, event: any, previousDragPos: Position) {
        // Find if there is any Modification nodes for the passed node
        const reactomeId = node.data('reactomeId');
        const modificationNodes = event.cy.nodes().filter((node: any) => {
            return node.data('nodeReactomeId') === reactomeId && node.hasClass('Modification');
        });
        if (!modificationNodes || modificationNodes.length === 0)
            return;
        const pos = node.position();
        let deltaX = pos.x - previousDragPos.x;
        let deltaY = pos.y - previousDragPos.y;
        for (let modificationNode of modificationNodes) {
            const pos = modificationNode.position();
            const newPos = {
                x: pos.x + deltaX,
                y: pos.y + deltaY
            };
            // Have to give it a new position object so that the label 
            // can be updated. Don't modify the position directly!!!
            modificationNode.position(newPos);
        }
        previousDragPos.x = node.position().x;
        previousDragPos.y = node.position().y;
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
            
            // TODO: Somehow the background of the selected image y location cannot be updated
            // Need to fix this bug.
            // compartment.style('background-position-y', compartment.style('height'));

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
        let { isInner, other } = this.getSiblingCompartment(compartment, cy);

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

   /**
     * Compartment may have two layers, both of which are displayed as nodes.
     * Use this method to find the other one.
     * @param compartment 
     */
    private getSiblingCompartment(compartment: any, cy: Core) {
        let compartmentId = compartment.id();
        // The id has two parts: graph id and inner or outer
        let tokens = compartmentId.split('-');
        let isInner = tokens[1] === 'inner';
        let otherId = tokens[0] + '-' + (isInner ? 'outer' : 'inner');
        let other = cy.$('#' + otherId);
        return { isInner, other };
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
                // Mimic the same data structure of Modification
                // so that we can have the same code to handle its behavior.
                nodeReactomeId: compartment.data('reactomeId'),
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
        const hyperEdge = this.id2hyperEdge.get(this.getHyperEdgeId(element));
        if (hyperEdge === undefined)
            return; // Nothing should be done if no HyperEdge here
        hyperEdge.removeNode(element);
    }

    addPoint(renderedPosition: Position,
             element: any) {
        if (!element.isEdge()) // Work for edge only
            return;
        // Find the HyperEdge this edge belong to
        const hyperEdgeId = this.getHyperEdgeId(element);
        if (!hyperEdgeId)
            return; // Do nothing
        const hyperEdge = this.id2hyperEdge.get(hyperEdgeId);
        if (hyperEdge === undefined)
            return; // Nothing should be done if no HyperEdge here
        hyperEdge.insertNode(renderedPosition, element);
    }

    private getHyperEdgeId(element: any) {
        // Try reactomeId first
        let hyperEdgeId = element.data('reactomeId');
        if (hyperEdgeId)
            return hyperEdgeId;
        // Try hyperEdgeId for flowLine
        hyperEdgeId = element.data('hyperEdgeId');
        return hyperEdgeId; // This may be undefined
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
        // But not compartment: In the editing mode, the user can move compartment too
        // apparently moving compartments is not good. Disable for now.
        diagram.cy.nodes('.Compartment').panify();
        // Get the position of nodes to be used for edges
        const id2node = new Map<string, any>();
        diagram.cy.nodes().forEach((node: any) => id2node.set(node.data('id'), node));
        const id2edges = new Map<number, any[]>();
        diagram.cy.edges().forEach((edge: any) => {
            const id = this.getHyperEdgeId(edge);
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
        return this.instanceUtils.copyData(data);
    }

    /**
     * A utitlity method to find the intersection point between a line that is drawn between externalPoint and
     * the node's position and the node's bounding rectangle. 
     * @param externalPoint 
     * @param node 
     */
    findIntersection(externalPoint: Position, node: any) {
        // The rectangle information of the node
        const center = node.position();
        // Give the bounding rectangle some buffer
        // by following the Java desktop version
        const width = node.width() + RENDERING_CONSTS.CONNECT_BUFFER * 2;
        const height = node.height() + RENDERING_CONSTS.CONNECT_BUFFER * 2;
        const halfWidth = width / 2.0;
        const halfHeight = height / 2.0;
        // Direction vector from external point to the rectangle's center
        const direction = {
            x: center.x - externalPoint.x,
            y: center.y - externalPoint.y
        };
        // t is the value in the following line between center and externalPoint:
        // L(t) = P + t(C-P)
        // Here P is the external point and C is the center and L(t) is a point
        // in the line that is created between P and C.
        // To simplify the code, calculate all four potential intersection together
        // and then determine what is the intersection
        // Check intersection with the left (x = center.x - halfWidth)
        // We need to calculate all four sides in order to find the intersection point
        // since we use either x or y, not both to calculate t-values
        const tValues: number[] = [];
        if (direction.x !== 0) {
            // Left
            let t = (center.x - halfWidth - externalPoint.x) / direction.x;
            tValues.push(t);
            // Right
            t = (center.x + halfWidth - externalPoint.x) / direction.x;
            tValues.push(t)
        }
        if (direction.y !== 0) {
            // bottom
            let t = (center.y + halfHeight - externalPoint.y) / direction.y;
            tValues.push(t);
            // top
            t = (center.y - halfHeight - externalPoint.y) / direction.y;
            tValues.push(t);
        }
        // Filter valid t avlues and find the closest point to the center
        // which has the largest t
        const validIntersections = tValues.filter(t => t >= 0 && t <= 1)
                                          .map(t => ({
                                            x: externalPoint.x + t * direction.x,
                                            y: externalPoint.y + t * direction.y,
                                            t: t
                                          }))
                                          .filter(point => 
                                            point.x >= center.x - halfWidth && point.x <= center.x + halfWidth && 
                                            point.y >= center.y - halfHeight && point.y <= center.y + halfHeight
                                          );
        if (validIntersections.length > 0) {
            // Find the closest intersection point (smallest t)
            const closestIntersection = validIntersections.reduce((closest, current) => 
                current.t > closest.t ? current : closest
            );
            return { x: closestIntersection.x, y: closestIntersection.y };
        }
        // Default to return the position of the node
        return {
            x: center.x,
            y: center.y
        }
    }
}
