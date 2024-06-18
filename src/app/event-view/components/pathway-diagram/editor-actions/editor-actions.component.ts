import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import exp from 'vectorious/dist/core/exp';

@Component({
  selector: 'app-editor-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-actions.component.html',
  styleUrl: './editor-actions.component.scss'
})
export class EditorActionsComponent {

  @Output() action = new EventEmitter<string>();
  @Input() isEditing: boolean = false;
  // Default is cytoscape
  @Input() elmType: ElementType = ElementType.CYTOSCAPE; 
  // Include this so that we can compare
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
  NODE = "node",
  COMPARTMENT = "compartment"
}
