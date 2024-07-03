/**
 * This component is a wrapper of cr-diagram to provide features for editing the pathway diagram that is displayed
 * in cytoscape. 
 */
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DiagramComponent } from 'ngx-reactome-diagram';
import { delay, map } from 'rxjs';
import { EditorActionsComponent, ElementType } from './editor-actions/editor-actions.component';
import { PathwayDiagramUtilService } from './utils/pathway-diagram-utils';
import { ReactomeEvent, ReactomeEventTypes } from 'ngx-reactome-cytoscape-style';
import { Position } from 'ngx-reactome-diagram/lib/model/diagram.model';
import { Instance } from 'src/app/core/models/reactome-instance.model';

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
    map(params => params['id'])
  )
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
  // Tracking the previous dragging position: should cytoscape provides this?
  previousDragPos: Position = {x: 0, y: 0};


  constructor(private route: ActivatedRoute,
    private diagramUtils: PathwayDiagramUtilService
  ){
  }

  ngAfterViewInit(): void {
    this.id$.pipe(delay(500)).subscribe(id => {
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
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + this.MENU_POSITION_BUFFER) + "px";
    this.menuPositionY = (event.renderedPosition.y + this.MENU_POSITION_BUFFER) + "px";
    this.showMenu = true;
  }

  onAction(action: string) {
    console.debug('action is fired: ' + action);
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
    else if (action === 'resizeCompartment') {
      this.diagramUtils.enableResizeCompartment(this.elementUnderMouse,
        this.diagram
      );
    }
    else if (action === 'disableResize') {
      this.diagramUtils.disableResizeCompartment(this.elementUnderMouse, this.diagram);
    }
    this.showMenu = false;
  }

  handleReactomeEvent(event: any) {
    const reactomeEvent = event as ReactomeEvent;
    if (reactomeEvent.type !== ReactomeEventTypes.select)
      return;
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
    console.debug('Add new event: ' + event);
    this.diagramUtils.addNewEvent(event, this.diagram.cy);
  }

}

