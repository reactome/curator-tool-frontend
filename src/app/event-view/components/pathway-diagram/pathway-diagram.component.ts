/**
 * This component is a wrapper of cr-diagram to provide features for editing the pathway diagram that is displayed
 * in cytoscape.
 */
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagramComponent } from 'ngx-reactome-diagram';
import { filter, map } from 'rxjs';
import { EditorActionsComponent, ElementType } from './editor-actions/editor-actions.component';
import { PathwayDiagramUtilService } from './utils/pathway-diagram-utils';
import { ReactomeEvent } from 'ngx-reactome-cytoscape-style';
import { Position } from 'ngx-reactome-diagram/lib/model/diagram.model';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';

@Component({
  selector: 'app-pathway-diagram',
  standalone: true,
  imports: [DiagramComponent, CommonModule, EditorActionsComponent],
  templateUrl: './pathway-diagram.component.html',
  styleUrl: './pathway-diagram.component.scss',
  providers: [PathwayDiagramUtilService]
})
export class PathwayDiagramComponent implements AfterViewInit {
  id$ = this.route.params.pipe(
    map(params => params['id']),
    filter(id => id !== undefined)
  )
  // pathway id for the displayed diagram
  // Note: This is not the id for the PathwayDiagram instance.
  pathwayId: string = ""; // Use empty string to make the diagram service happy
  // keep the select id in queryParam
  select: string = "";

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
  // Tracking the previous dragging position: should cytoscape provides this?
  previousDragPos: Position = {x: 0, y: 0};

  // To show information
  readonly dialog = inject(MatDialog);

  constructor(private route: ActivatedRoute,
    private router: Router,
    private diagramUtils: PathwayDiagramUtilService
  ){
  }


  ngAfterViewInit(): void {
    this.route.params.subscribe(params => {
      console.debug('Route params before loading in pathway-dagiram: ', params);
      const queryParams = this.route.snapshot.queryParams;
      console.debug('Query params before loading in pathway-diagram: ', queryParams);
      const id = params['id'];
      // Do nothing if nothing is loaded
      if (!id) return;
      this.pathwayId = id;
      this.diagram.diagramId = this.pathwayId;
      this.select = queryParams['select'] ?? '';
      // Reset the previous state
      // Technically this is not necessary. However, just need to clean-up
      // the original state before loading a new diagram.
      //this.diagram.resetState();
      // Check if we have cytoscape network. If yes, load it.
      this.diagramUtils.getDataService().hasCytoscapeNetwork(this.pathwayId).subscribe((exists: boolean) => {
        if (exists) {
          this.diagramUtils.getDataService().getCytoscapeNetwork(this.pathwayId).subscribe((cytoscapeJson: any) => {
            this.diagram.displayNetwork(cytoscapeJson.elements);
          });
        }
        // Otherwise, handle it in the old way to load the diagrams converted from XML.
        else {
          this.diagram.loadDiagram();
        }
      });
    });
    // Do any post processing after the network is displayed.
    // Use this method to avoid threading issue and any arbitray delay.
    this.diagram.cytoscapeContainer!.nativeElement.addEventListener('network_displayed', () => {
      this.initDiagram();
      // Need to do selection here
      this.selectObjectsInDiagram(this.select);
    })
    // The following works and may provide some flexibility. However,
    // this may bring us some headack to handle the two subscriptions
    // for both pathParams and queryParams. It may not be reliable
    // to figure out the sequence of these two subscriptions. Therefore,
    // we will handle the event click directly to synchronize selection.
    // // Handle the selection when in the same diagram.
    // // Ideally this should be handled inside the diagram widget.
    // this.router.events.pipe(
    //   filter(event => event instanceof NavigationEnd)
    // ).subscribe(() => {
    //   // Handle query params change here
    //   const queryParams = this.route.snapshot.queryParams;
    //   const params = this.route.snapshot.params;
    //   console.log('Query Params Changed in pathway-diagram: ', queryParams);
    //   console.log('Route params in pathway-diagram: ', params);
    //   if (this.pathwayId !== params['id'])
    //     return;
    //   this.selectObjectsInDiagram(queryParams['select']);
    // });
  }

  /**
   * Select objects in cytoscape.js based on the passed dbId.
   * Note: dbId may be a list of ids separated by ','.
   * @param dbId
   */
  selectObjectsInDiagram(dbId: any) {
    if (dbId) {
      this.diagramUtils.select(this.diagram, dbId);
    }
    else {
      this.diagramUtils.clearSelection(this.diagram);
    }
  }

  private initDiagram() {
    // Do nothing if nothing is loaded
    if (!this.pathwayId || this.pathwayId.length == 0)
      return;
    this.diagramUtils.diagramService = this.diagram.getDiagramService();
    // When the diagram is loaded first, disable node dragging to avoid
    // change the coordinates
    this.diagram.cy.nodes().grabify().panify();

    // Have to add the following to zoom using mouse scroll.
    this.diagram.cy.zoomingEnabled(true);
    this.diagram.cy.userZoomingEnabled(true);
    this.diagram.cy.panningEnabled(true);
    this.diagram.cy.userPanningEnabled(true);

    // Add the popup trigger to the whole cytoscape and let
    // showCyPopup to figure out what menus should be shown.
    this.diagram.cy.on('cxttapstart', (e:any) => {
      this.showCyPopup(e);
    });
    this.diagram.cy.on('mousedown', (e: any) => {
      // Make sure isNode is defined as a function to avoid an error
      if (e.target !== undefined && typeof e.target.isNode === 'function') {
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
      if (node.hasClass('resizing')) {
        this.diagramUtils.resizeCompartment(node, e, this.previousDragPos);
      }
    });
  }

  private showCyPopup(event: any) { // Use any to avoid any compiling error
    this.elementUnderMouse = event.target;
    if (this.elementUnderMouse === undefined ||
        this.elementUnderMouse === this.diagram!.cy) { // Should check for instanceof. But not sure how!
      this.elementTypeForPopup = ElementType.CYTOSCAPE; // As the default
    }
    else if (this.elementUnderMouse.isEdge()) {
      this.elementTypeForPopup = ElementType.EDGE;
    }
    else if (this.elementUnderMouse.isNode()) {
      if (this.elementUnderMouse.hasClass("Compartment"))
        this.elementTypeForPopup = ElementType.COMPARTMENT;
      else
        this.elementTypeForPopup = ElementType.NODE;
    }
    else
      this.elementTypeForPopup = ElementType.CYTOSCAPE;
    this.isEdgeEditable = this.diagramUtils.isEdgeEditable(this.elementUnderMouse);
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
    this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
    this.showMenu = true;
  }

  onAction(action: string) {
    console.debug('action is fired: ' + action);
    //TODO: Make sure enable and disable works for individual reaction too.
    if (action === 'enableEditing') {
      this.diagramUtils.enableEditing(this.diagram);
      this.isEditing = true;
    }
    else if (action === 'disableEditing') {
      this.diagramUtils.disableEditing(this.diagram);
      this.isEditing = false;
    }
    else if (action === 'addPoint') {
      // Get the current mouse position when the popup menu appears
      const mousePosition : Position = {
        x: parseInt(this.menuPositionX) - this.MENU_POSITION_BUFFER,
        y: parseInt(this.menuPositionY) - this.MENU_POSITION_BUFFER
      }
      this.diagramUtils.addPoint(mousePosition, this.elementUnderMouse);
    }
    else if (action === 'removePoint') {
      this.diagramUtils.removePoint(this.elementUnderMouse);
    }
    else if (action === 'delete') {
      this.diagramUtils.deleteHyperEdge(this.elementUnderMouse);
    }
    else if (action === 'resizeCompartment') {
      this.diagramUtils.enableResizeCompartment(
        this.elementUnderMouse,
        this.diagram
      );
    }
    else if (action === 'disableResize') {
      this.diagramUtils.disableResizeCompartment(this.elementUnderMouse, this.diagram);
    }
    else if (action === 'toggleDarkMode') {
      this.diagram.dark.isDark = !this.diagram.dark.isDark;
    }
    else if (action === 'upload') {
      // TODO: de-select everything first to avoid keeping the selected color at JSON.
      // However, we may need to re-select to make the selection consistent.
      const networkJson = this.diagram.cy.json();
      // const networkString = JSON.stringify(networkJson);
      // console.debug('Network JSON: \n' + networkString);
      this.diagramUtils.getDataService().uploadCytoscapeNetwork(this.diagram.diagramId, networkJson).subscribe((success) => {
        if (success) {
          // Need to show something here
          this.dialog.open(InfoDialogComponent, {
            data: {
              title: 'Information',
              message: 'The diagram has been uploaded successfully.'
            }
          });
        }
        else {
          // Need to show something here
          this.dialog.open(InfoDialogComponent, {
            data: {
              title: 'Error',
              message: 'The diagram has not been uploaded successfully.'
            }
          });
        }
      })
    }
    this.showMenu = false;
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
        return  (elm.data('reactomeId') && (elm.data('reactomeId') === reactomeId)) ||
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
          message: 'This reaction is in the diagram already: ',
          instanceInfo: event.displayName + '[' + event.dbId + ']'
        }
      });
      return;
    }
    this.diagramUtils.addNewEvent(event, this.diagram.cy);
  }

}

