import { CommonModule } from '@angular/common';
import { Component, EventEmitter, input, Input, Output } from '@angular/core';

@Component({
  selector: 'app-editor-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-actions.component.html',
  styleUrl: './editor-actions.component.scss'
})
export class EditorActionsComponent {

  @Output() action = new EventEmitter<string>();
  // Used to flag the selected edge
  @Input() isEdgeEditable: boolean = false;
  // Flag for adding a flow line
  @Input() isFlowLineAddable: boolean = false;
  // Use to flag the whole diagram
  @Input() isDiagramEditing: boolean = false;
  // Flag this diagram has been edited but not saved yet
  @Input() isDiagramEdited: boolean = false;
  // Default is cytoscape
  @Input() elmType: ElementType = ElementType.CYTOSCAPE; 
  // Check if a clicked pathway is deletable
  @Input() isPathwayDeletable: boolean = false;
  // Flag if a selected node is resizing
  @Input() isNodeResizing: boolean = false;
  // Flag is a selected node is resizable
  @Input() isNodeResizable: boolean = true;
  // Track lock acquire in progress to prevent duplicate requests.
  @Input() isLockAcquiring: boolean = false;
  @Input() isLockOwnedByMe: boolean = false;
  // Include this so that we can compare in the html template
  elmTypes = ElementType;
  
  constructor() {
  }

  onClick(action: string) {
    this.action.emit(action);
  }

}

export enum ElementType {
  CYTOSCAPE = "cytoscape",
  EDGE = "edge",
  FLOWLINE = 'flowline',
  EDGE_POINT = 'edgePoint',
  NODE = "node",
  PE_Node = 'physicalentity_node',
  COMPARTMENT = "compartment",
  PATHWAY_NODE = 'pathway_node',
  MULTIPLE_NODES = 'multiple_nodes'
}
