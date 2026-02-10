/**
 * This component is a wrapper of cr-diagram to provide features for editing the pathway diagram that is displayed
 * in cytoscape.
 */
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, inject, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { DiagramComponent } from 'ngx-reactome-diagram';
import { filter, map } from 'rxjs';
import { EditorActionsComponent, ElementType } from './editor-actions/editor-actions.component';
import { PathwayDiagramUtilService } from './utils/pathway-diagram-utils';
import { ReactomeEvent } from 'ngx-reactome-cytoscape-style';
import { Position } from 'ngx-reactome-diagram/lib/model/diagram.model';
import { EDGE_POINT_CLASS, Instance } from 'src/app/core/models/reactome-instance.model';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { InstanceUtilities } from 'src/app/core/services/instance.service';

@Component({
  selector: 'app-pathway-diagram',
  standalone: true,
  imports: [DiagramComponent, CommonModule, EditorActionsComponent],
  templateUrl: './pathway-diagram.component.html',
  styleUrl: './pathway-diagram.component.scss',
  providers: [PathwayDiagramUtilService]
})
export class PathwayDiagramComponent implements AfterViewInit, OnInit {
  // Special case to navigate away from the current event
  @Output() goToPathwayEvent = new EventEmitter<number>();
  @Output() openPathwayDiagramEvent = new EventEmitter<any>();
  id$ = this.route.params.pipe(
    map(params => params['id']),
    filter(id => id !== undefined)
  )
  // pathway id for the displayed diagram
  // Note: This is not the id for the PathwayDiagram instance.
  pathwayId: string = ""; // Use empty string to make the diagram service happy
  // keep the select id in queryParam
  select: string = "";
  // PathwayDiagram id for editing
  pathwayDiagramId: string = "";

  @ViewChild('diagramComponent')
  diagram!: DiagramComponent;

  // Try to control the popup menu
  showMenu: boolean = false;
  menuPositionX: string = "0px";
  menuPositionY: string = "0px";
  // A little bit buffer between the mouse point and the menu position
  MENU_POSITION_BUFFER = 5;

  // The current node or edge under the mouse
  elementUnderMouse: any;
  elementTypeForPopup: ElementType = ElementType.CYTOSCAPE; // Default always
  // Tracking the diting status
  isEditing: boolean = false;
  // Flag is the edge under the mouse is edtiable
  // If the element under the mouse is not an edge, this flag should be false
  isEdgeEditable: boolean = false;
  // Flag for adding a flowline between a PE node and a ProcessNode (for pathway)
  isFlowLineAddable: boolean = false;
  // flag is the clicked pathway is deletable
  isPathwayDeletable: boolean = false;
  // Tracking the previous dragging position: should cytoscape provides this?
  previousDragPos: Position = { x: 0, y: 0 };
  // Track a list of nodes that are under resizing
  resizingNodes: any[] = [];
  // Tracking the last viewport for restoring after reloading
  private storedViewport: { zoom: number, pan: { x: number, y: number } } | null = null;
  private lastLoadedNetworkId: string = '';
  // To show information
  readonly dialog = inject(MatDialog);

  constructor(private route: ActivatedRoute,
    private router: Router,
    private diagramUtils: PathwayDiagramUtilService,
    private instUtil: InstanceUtilities
  ) {
  }

  ngOnInit() {
    this.instUtil.resetInst$.subscribe((data)=> {
      this.diagramUtils.handleInstanceReset(data, this);
    });
    this.instUtil.lastUpdatedInstance$.subscribe(data => {
      this.diagramUtils.handleInstanceEdit(data.attribute, data.instance, this);
    });
  }

  ngAfterViewInit(): void {
    this.route.params.subscribe(params => {
      console.debug('Route params before loading in pathway-dagiram: ', params);
      const queryParams = this.route.snapshot.queryParams;
      console.debug('Query params before loading in pathway-diagram: ', queryParams);
      const id = params['id'];
      // Do nothing if nothing is loaded
      if (!id || id === '0') return;
      this.pathwayId = id;
      this.diagram.diagramId = this.pathwayId;
      this.select = queryParams['select'] ?? '';
      // Always not in the editing mode when loading via URL
      this.isEditing = false;
      this.loadPathwayDiagram();
      this.pathwayDiagramId = ''; // reset any previous PathwayDiagram id
    });
    // Do any post processing after the network is displayed.
    // Use this method to avoid threading issue and any arbitray delay.
    this.diagram.cytoscapeContainer!.nativeElement.addEventListener('network_displayed', () => {
      this.initDiagram();
      // Need to do selection here
      this.selectObjectsInDiagram(this.select);
    })
    // The following works and may provide some flexibility. However,
    // this may bring us some headace to handle the two subscriptions
    // for both pathParams and queryParams. It may not be reliable
    // to figure out the sequence of these two subscriptions. Therefore,
    // we will handle the event click directly to synchronize selection.
    // Handle the selection when in the same diagram.
    // Ideally this should be handled inside the diagram widget.
    // Turn both on and pay attention to any side effects
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Handle query params change here
      const queryParams = this.route.snapshot.queryParams;
      const params = this.route.snapshot.params;
      if (this.pathwayId !== params['id'])
        return;
      const currentSelected = queryParams['select'];
      this.select = currentSelected;
      this.selectObjectsInDiagram(currentSelected);
    });
  }

  private storeViewport() {
    if (this.diagram.cy) {
      this.storedViewport = {
        zoom: this.diagram.cy.zoom(),
        pan: this.diagram.cy.pan()
      };
      console.debug('Stored viewport:', this.storedViewport);
    }
  }

  private loadPathwayDiagram() {
    this.storeViewport();
    // Check if we have cytoscape network. If yes, load it.
    this.diagramUtils.getDataService().hasCytoscapeNetwork(this.diagram.diagramId).subscribe((exists: boolean) => {
      // this.diagram.resetState(); 
      this.diagramUtils.clearSelection(this.diagram);
      if (exists) {
        this.diagramUtils.getDataService().getCytoscapeNetwork(this.diagram.diagramId).subscribe((cytoscapeJson: any) => {
          this.diagram.displayNetwork(cytoscapeJson.elements);
        });
      }
      // Otherwise, handle it in the old way to load the diagrams converted from XML.
      else {
        this.diagram.loadDiagram();
      }
    });
  }

  /**
   * When a diagram is switched to the editing mode, its PathwayDiagram JSON diagram will be used for editing.
   * If the diagram is not shared (i.e. there is only one representedPathway in the PathwayDiagram instance), the PathwayDiagram
   * and Pathway itself should have the same JSON text. Using either JSON text should be fine. As the matter of the fact, the 
   * backend uses symbolic link to point to the same JSON text for both instances. However, if the diagram is shared by multiple pathways 
   * (one normal and other disease Pathways), the PathwayDiagram JSON text may be different from the Pathway JSON text. Disabling editing
   * will still use the editing JSON text, which is PathwayDiagram, for display to keep the users at the same view. The user has to 
   * upload the edited pathway diagram to the JSON text for the Pathway instance, which is post-processed at the server side for 
   * overlaying etc.
   */
  private disableEditing() {
    this.diagramUtils.disableEditing(this.diagram);
    this.resizingNodes.forEach(node => this.diagramUtils.disableResizeCompartment(node, this.diagram));
    this.resizingNodes.length = 0; // reset to empty
    this.isEditing = false;
  }

  private enableEditing() {
    if (this.pathwayDiagramId && this.pathwayDiagramId.length > 0) {
      // Already have a PathwayDiagram id for editing
      this.isEditing = true;
      this.diagram.diagramId = this.pathwayDiagramId;
      this.loadPathwayDiagram();
      return;
    }
    // Switch to PathwayDiagram 
    this.diagramUtils.getDataService().fetchPathwayDiagram(this.pathwayId).subscribe((pathwayDiagram: Instance) => {
      if (pathwayDiagram) {
        this.isEditing = true;
        this.diagram.diagramId = pathwayDiagram.dbId.toString();
        // Let the event handler for "network_displayed" to handle the rest
        this.loadPathwayDiagram();
        this.pathwayDiagramId = pathwayDiagram.dbId.toString(); // Store it for future use
      }
      else {
        this.dialog.open(InfoDialogComponent, {
          data: {
            title: 'Error',
            message: 'No PathwayDiagram instance is associated with this pathway: ',
            instanceInfo: this.pathwayId
          }
        });
      }
    });
  }

  /**
   * Select objects in cytoscape.js based on the passed dbId.
   * Note: dbId may be a list of ids separated by ','.
   * @param dbId
   */
  selectObjectsInDiagram(dbId: any) {
    if (dbId) {
      const id = parseInt(dbId);
      if (this.diagramUtils.isDbIdSelected(this.diagram, id))
        return;
      this.diagramUtils.select(this.diagram, dbId);
    }
    else {
      this.diagramUtils.clearSelection(this.diagram);
    }
  }

  /**
   * Create an empty diagram for editing.
   * @param pathwayId
   */
  createEmptyDiagram(pathwayId: number) {
    this.pathwayId = pathwayId.toString();
    this.diagram.diagramId = this.pathwayId;
    this.select = '';

    // this.diagram.resetState(); 
    this.diagramUtils.clearSelection(this.diagram);
    // Show nothing for this diagram
    this.diagram.displayNetwork([]);
  }

  private initDiagram() {
    // Do nothing if nothing is loaded
    if (!this.pathwayId || this.pathwayId.length == 0)
      return;
    this.diagramUtils.diagramService = this.diagram.getDiagramService();
    // When the diagram is loaded first, disable node dragging to avoid
    // change the coordinates
    this.diagram.cy.nodes().grabify().panify();

    // Force it to use the light mode
    this.diagram.dark.isDark = false;

    // Have to add the following to zoom using mouse scroll.
    this.diagram.cy.zoomingEnabled(true);
    this.diagram.cy.userZoomingEnabled(true);
    this.diagram.cy.panningEnabled(true);
    this.diagram.cy.userPanningEnabled(true);

    // Add the popup trigger to the whole cytoscape and let
    // showCyPopup to figure out what menus should be shown.
    this.diagram.cy.on('cxttapstart', (e: any) => {
      this.showCyPopup(e);
    });
    this.diagram.cy.on('mousedown', (e: any) => {
      // Make sure isNode is defined as a function to avoid an error
      if (e.target !== undefined && typeof e.target.isNode === 'function') {
        if (e.target.hasClass('Modification') && !e.target.hasClass('resizing')) {
          return;
        }
        // Since we cannot get the mouse position during dragging
        // we use the target's position for the relative changes.
        const pos = e.target.position();
        this.previousDragPos.x = pos.x;
        this.previousDragPos.y = pos.y;
      }
      if (this.showMenu) {
        this.showMenu = false;
        e.preventDefault();
      }
    });
    this.diagram.cy.on('mouseup', (e: any) => {
      // reset previous drag position
      this.previousDragPos.x = 0;
      this.previousDragPos.y = 0;
    });
    // Resize the compartment for resizing nodes
    this.diagram.cy.on('drag', 'node', (e: any) => {
      let node = e.target;
      // If a node that had resize enabled is being moved, disable its resize mode
      if (this.resizingNodes.includes(node)) {
        this.diagramUtils.disableResizeCompartment(node, this.diagram);
        const idx = this.resizingNodes.indexOf(node);
        if (idx >= 0) this.resizingNodes.splice(idx, 1);
      }

      if (node.hasClass('Modification') && !e.target.hasClass('resizing')) 
        return; // Modification nodes are handled in moveModifications. No need to handle here.
      if (node.hasClass('resizing')) {
        // This may be used for both compartment and PE node
        this.diagramUtils.resizeCompartment(node, e, this.previousDragPos);        
      }
      else if (node.hasClass('Protein') || node.hasClass('RNA') || node.hasClass('Gene')) {
        // Handle Modification move only for the above three types of nodes.
        this.diagramUtils.moveModifications(node, e, this.previousDragPos);
      }
      // Always update previousDragPos to track the current position
      const pos = node.position();
      this.previousDragPos.x = pos.x;
      this.previousDragPos.y = pos.y;
    });
    // Reset for anything for editing
    this.diagramUtils.id2hyperEdge.clear();
    if (this.isEditing) {
      this.diagramUtils.enableEditing(this.diagram);
    }
    this.restoreViewport();
  }

  private restoreViewport() {
    if (this.storedViewport && this.diagram.cy && this.pathwayId === this.lastLoadedNetworkId) {
      this.diagram.cy.viewport({
        zoom: this.storedViewport.zoom,
        pan: this.storedViewport.pan
      });
      console.debug('Restored viewport:', this.storedViewport);
    }
    this.lastLoadedNetworkId = this.pathwayId;
  }

  private showCyPopup(event: any) { // Use any to avoid any compiling error
    this.elementUnderMouse = event.target;
    
    // Check for multiple selected nodes with reactomeId in editing mode first
    if (this.isEditing && this.diagram?.cy) {
      const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
        // Use the following to check if it is a reaction node or PE node
        return this.isNodeForAlignment(node);
      });
      if (selectedNodes.length > 1) {
        this.elementTypeForPopup = ElementType.MULTIPLE_NODES;
        // The offset set 5px is important to prevent the native popup menu appear
        this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
        this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
        this.showMenu = true;
        return;
      }
    }
    
    if (this.elementUnderMouse === undefined ||
      this.elementUnderMouse === this.diagram!.cy) { // Should check for instanceof. But not sure how!
      this.elementTypeForPopup = ElementType.CYTOSCAPE; // As the default
    }
    else if (this.elementUnderMouse.isEdge()) {
      if (this.elementUnderMouse.data('edgeType') === 'FlowLine')
        this.elementTypeForPopup = ElementType.FLOWLINE;
      else
        this.elementTypeForPopup = ElementType.EDGE;
    }
    else if (this.elementUnderMouse.isNode()) {
      if (this.elementUnderMouse.hasClass("Compartment")) 
        this.elementTypeForPopup = ElementType.COMPARTMENT;
      else if (this.elementUnderMouse.hasClass('PhysicalEntity')) {
        this.elementTypeForPopup = ElementType.PE_Node;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
      }
      else if (this.elementUnderMouse.hasClass("SUB")) { // This is for pathway
        this.elementTypeForPopup = ElementType.PATHWAY_NODE;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
        this.isPathwayDeletable = this.diagramUtils.isPathwayDeletable(this.elementUnderMouse);
      }
      else if (this.elementUnderMouse.hasClass(EDGE_POINT_CLASS))
        this.elementTypeForPopup = ElementType.EDGE_POINT;
      else {
        this.elementTypeForPopup = ElementType.NODE;
        this.isFlowLineAddable = this.diagramUtils.isFlowLineAddable(this.elementUnderMouse, this);
      }
    }
    else
      this.elementTypeForPopup = ElementType.CYTOSCAPE;
    this.isEdgeEditable = this.diagramUtils.isEdgeEditable(this.elementUnderMouse);
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
    this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
    this.showMenu = true;
  }

  isNodeResizing() {
    if (!this.elementUnderMouse)
      return false;
    return this.resizingNodes.includes(this.elementUnderMouse);
  }

  onAction(action: string) {
    console.debug('Action fired: ' + action);

    switch (action) {
      case 'enableEditing':
        this.enableEditing();
        break;

      case 'disableEditing':
        this.disableEditing();
        break;

      case 'disableEdgeEditing':
        const hyperEdgeId = this.diagramUtils.getHyperEdgeId(this.elementUnderMouse);
        this.diagramUtils.disableReactionEditing(hyperEdgeId, this.diagram);
        break;

      case 'enableEdgeEditing':
        // Cannot name it as hyperEdgeId since it is in the same block as the previous one
        const hyperEdgeId1 = this.diagramUtils.getHyperEdgeId(this.elementUnderMouse);
        this.diagramUtils.enableReactionEditing(hyperEdgeId1, this.diagram);
        break;

      case 'addPoint':
        const mousePosition: Position = {
          x: parseInt(this.menuPositionX) - this.MENU_POSITION_BUFFER,
          y: parseInt(this.menuPositionY) - this.MENU_POSITION_BUFFER
        };
        this.diagramUtils.addPoint(mousePosition, this.elementUnderMouse);
        break;

      case 'removePoint':
        this.diagramUtils.removePoint(this.elementUnderMouse);
        break;

      case 'delete':
        this.diagramUtils.deleteHyperEdge(this.elementUnderMouse);
        break;

      case 'resizeCompartment':
        this.diagramUtils.enableResizeCompartment(this.elementUnderMouse, this.diagram);
        this.resizingNodes.push(this.elementUnderMouse);
        break;

      case 'disableResize':
        this.disableResize();
        break;

      case 'toggleDarkMode':
        this.diagram.dark.isDark = !this.diagram.dark.isDark;
        break;

      case 'addFlowLine':
        this.diagramUtils.addFlowLine(this.elementUnderMouse, this);
        break;

      case 'goToPathway':
        const reactomeId = this.elementUnderMouse?.data('reactomeId');
        if (reactomeId) {
          // this.router.navigate(['/event_view/instance/' + reactomeId]);
          // We will let the event tree to handle the router etc to show the diagram
          this.goToPathwayEvent.emit(reactomeId);
        }
        break;

      case 'deletePathway':
        if (this.resizingNodes.includes(this.elementUnderMouse)) {
          this.disableResize();
        }
        this.diagramUtils.deletePathwayNode(this.elementUnderMouse, this.diagram);
        break;

      case 'deleteCompartment':
        if (this.resizingNodes.includes(this.elementUnderMouse)) {
          this.disableResize();
        }
        this.diagramUtils.deleteCompartment(this.elementUnderMouse, this.diagram);
        break;

      case 'insertCompartment':
        this.diagramUtils.insertCompartment(this.diagram);
        break;

      case 'upload':
        this.uploadDiagram();
        break;

      case 'reload':
        this.diagram.diagramId = this.pathwayId
        // Disable editing first
        this.isEditing = false;
        this.loadPathwayDiagram();
        break;

      case 'editPathwayDiagram':
        this.diagramUtils.getDataService().fetchPathwayDiagram(this.pathwayId).subscribe((pathwayDiagram: Instance) => {
          if (pathwayDiagram) {
            this.openPathwayDiagramEvent.emit(pathwayDiagram.dbId);
          }
          else {
            this.dialog.open(InfoDialogComponent, {
              data: {
                title: 'Error',
                message: 'No PathwayDiagram instance is associated with this pathway: ',
                instanceInfo: this.pathwayId
              }
            });
          }
        });
        break;

      case 'alignCentersVertically':
        this.alignNodesVertically();
        break;

      case 'alignCentersHorizontally':
        this.alignNodesHorizontally();
        break;

      default:
        console.debug('Unknown action: ' + action);
        break;
    }

    // Hide the menu after the action is processed
    this.showMenu = false;
  }

  private uploadDiagram() {
    // Check if PathwayDiagram is being edited. If PathwayDiagram is not being edited,
    // tell the user nothing to be uploaded.
    if (this.pathwayDiagramId !== undefined && this.pathwayDiagramId.length === 0) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'The diagram is not being edited. Nothing to be uploaded.'
        }
      });
      return;
    }
    // Make sure disable diagram first
    if (this.isEditing)
      this.diagramUtils.disableEditing(this.diagram);
    // cy refers to itself. This creates a circular structure.
    // Need to do a little bit of workaround here.
    // Get rid of any circular structure by doing the following fixes
    const nodes = this.diagram.cy.nodes().jsons();
    const edges = this.diagram.cy.edges().jsons();
    const elements = {
      nodes: nodes,
      edges: edges
    };
    // We will use the default style and avoid keeping style. This also reduce the size of
    // the uploaded JSON.
    // const metadata = {
    //   zoom: this.diagram.cy.zoom(),
    //   pan: this.diagram.cy.pan(),
    //   style: this.diagram.cy.style().json()
    // };
    const networkJson = {
      elements: elements,
      // metadata: metadata
    };

    // Use pathwayDiagramId, instead of pathwayId for uploading
    this.diagramUtils.getDataService().uploadCytoscapeNetwork(this.pathwayDiagramId, networkJson).subscribe((success) => {
      const dialogConfig = {
        data: {
          title: success ? 'Information' : 'Error',
          message: success ? 'The diagram has been uploaded successfully.' : 'The diagram has not been uploaded successfully.'
        }
      };
      this.dialog.open(InfoDialogComponent, dialogConfig);
      if (this.isEditing)
        this.enableEditing();
    });
  }

  private disableResize() {
    this.diagramUtils.disableResizeCompartment(this.elementUnderMouse, this.diagram);
    const index = this.resizingNodes.indexOf(this.elementUnderMouse);
    if (index >= 0)
      this.resizingNodes.splice(index, 1);
  }

  handleReactomeEvent(event: any) {
    const reactomeEvent = event as ReactomeEvent;
    // Forward event selection
    // Turn this on only for debug select. Need this for all events
    // if (reactomeEvent.type !== ReactomeEventTypes.select) {
    //   return;
    // }
    // Apparently we cannot use isNode or isEdge to check the detail's type.
    // We have to use this way to check if a reaction or a node is used.
    let reactomeId = event.detail.reactomeId;
    let affectedElms = undefined;
    if (reactomeEvent.detail.type !== 'reaction') { // Check for node attachment only
      affectedElms = this.diagram.cy.nodes().filter((node: any) => {
        // This is for nodeAttachments!
        return node.data('nodeReactomeId') && node.data('nodeReactomeId') === reactomeId;
      }
      );
    }
    else {
      // We'd like to get the reaction node too. Therefore, scan all elements.
      affectedElms = this.diagram.cy.elements().filter((elm: any) => {
        return (elm.data('reactomeId') && (elm.data('reactomeId') === reactomeId)) ||
          (elm.data('nodeReactomeId') && (elm.data('nodeReactomeId') === reactomeId));
      });
    }
    if (affectedElms === undefined || affectedElms.length === 0)
      return;
    this.diagram.applyEvent(event, affectedElms);
  }

  addEvent(event: Instance) {
    if (this.diagramUtils.isEventAdded(event, this.diagram.cy)) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Error',
          message: 'This event has been added in the diagram already: ',
          instanceInfo: event.displayName + '[' + event.dbId + ']'
        }
      });
      return;
    }
    // Need to enable editing first
    if (!this.isEditing) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Error',
          message: 'Editing must be enabled before adding a new event.',
          instanceInfo: event.displayName + '[' + event.dbId + ']'
        }
      });
      return;
    }
    this.diagramUtils.addNewEvent(event, this.diagram.cy);
  }

  private alignNodesVertically() {
    if (!this.diagram?.cy) return;
    
    const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
      return this.isNodeForAlignment(node);
    });
    if (selectedNodes.length < 2) return;
    
    // Calculate the average x position (vertical center line)
    let totalX = 0;
    selectedNodes.forEach((node: any) => {
      totalX += node.position('x');
    });
    const averageX = totalX / selectedNodes.length;
    
    // Move all nodes to the average x position and their modification nodes
    selectedNodes.forEach((node: any) => {
      const oldX = node.position('x');
      const deltaX = averageX - oldX;
      
      node.position('x', averageX);
      
      // Move associated modification nodes
      const reactomeId = node.data('reactomeId');
      const modificationNodes = this.diagram.cy.nodes().filter((modNode: any) => {
        return modNode.data('nodeReactomeId') === reactomeId && modNode.hasClass('Modification');
      });
      
      modificationNodes.forEach((modNode: any) => {
        const modPos = modNode.position();
        modNode.position({
          x: modPos.x + deltaX,
          y: modPos.y
        });
      });
    });
  }

  private alignNodesHorizontally() {
    if (!this.diagram?.cy) return;
    
    const selectedNodes = this.diagram.cy.$(':selected').nodes().filter((node: any) => {
      return this.isNodeForAlignment(node);
    });
    if (selectedNodes.length < 2) return;
    
    // Calculate the average y position (horizontal center line)
    let totalY = 0;
    selectedNodes.forEach((node: any) => {
      totalY += node.position('y');
    });
    const averageY = totalY / selectedNodes.length;
    
    // Move all nodes to the average y position and their modification nodes
    selectedNodes.forEach((node: any) => {
      const oldY = node.position('y');
      const deltaY = averageY - oldY;
      
      node.position('y', averageY);
      
      // Move associated modification nodes
      const reactomeId = node.data('reactomeId');
      const modificationNodes = this.diagram.cy.nodes().filter((modNode: any) => {
        return modNode.data('nodeReactomeId') === reactomeId && modNode.hasClass('Modification');
      });
      
      modificationNodes.forEach((modNode: any) => {
        const modPos = modNode.position();
        modNode.position({
          x: modPos.x,
          y: modPos.y + deltaY
        });
      });
    });
  }

  /**
   * Check if a node should be used for alignment
   * @param node
   * @returns 
   */
  private isNodeForAlignment(node: any): boolean {
    return node.hasClass('PhysicalEntity') || (node.hasClass('reaction') && !node.hasClass(EDGE_POINT_CLASS));
  }

}

