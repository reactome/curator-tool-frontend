import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

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
  
  constructor() {
  }

  onClick(action: string) {
    this.action.emit(action);
  }

}
