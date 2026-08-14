import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
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
  // Emits the raw text the user entered when they press Enter in the "Find by dbId" field.
  @Output() findByDbId = new EventEmitter<string>();

  @ViewChild('dbIdInput') private dbIdInputRef?: ElementRef<HTMLInputElement>;
  // The "Find by dbId" control collapses down to a single search icon, matching the other
  // toolbar buttons, and only expands into a text field once clicked.
  showDbIdSearch: boolean = false;

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

  openDbIdSearch(): void {
    this.showDbIdSearch = true;
    // Wait for the input to render before focusing it.
    setTimeout(() => this.dbIdInputRef?.nativeElement.focus());
  }

  onFindByDbId(value: string) {
    this.findByDbId.emit(value);
    this.showDbIdSearch = false;
  }
}
