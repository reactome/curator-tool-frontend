import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-editor-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-actions.component.html',
  styleUrl: './editor-actions.component.scss'
})
export class EditorActionsComponent {

  @Output() action = new EventEmitter<string>();
  
  constructor() {
  }

  onClick(action: string) {
    this.action.emit(action);
  }

}
