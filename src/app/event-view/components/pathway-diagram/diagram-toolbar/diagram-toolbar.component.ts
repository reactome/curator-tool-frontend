import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Toolbar for global/mode-level pathway diagram editing actions, i.e. actions that
 * apply to the whole diagram or the current selection rather than to whatever
 * element happens to be under the mouse. Element-specific actions (add/remove an
 * edge point, delete a compartment, resize, etc.) remain in the right-click menu
 * (app-editor-actions) since they require a specific target element.
 */
@Component({
  selector: 'app-diagram-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatToolbarModule, MatTooltipModule],
  templateUrl: './diagram-toolbar.component.html',
  styleUrl: './diagram-toolbar.component.scss'
})
export class DiagramToolbarComponent {
  @Output() action = new EventEmitter<string>();

  @Input() isDiagramEditing: boolean = false;
  @Input() isDiagramEdited: boolean = false;
  @Input() isLockAcquiring: boolean = false;
  @Input() isLockOwnedByMe: boolean = false;
  @Input() canUndo: boolean = false;
  @Input() canRedo: boolean = false;
  // Whether at least two alignable nodes are currently selected.
  @Input() canAlign: boolean = false;
  // Whether any compartment currently has resize widgets showing.
  @Input() hasActiveResizing: boolean = false;

  onClick(action: string) {
    this.action.emit(action);
  }
}
