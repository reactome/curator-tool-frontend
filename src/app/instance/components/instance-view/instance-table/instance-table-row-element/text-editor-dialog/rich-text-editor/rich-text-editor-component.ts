import { OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Editor, NgxEditorModule } from 'ngx-editor';

import { Component } from '@angular/core';

@Component({
  selector: 'app-editor',
  templateUrl: './rich-text-editor-component.html',
  styleUrls: ['./rich-text-editor-component.scss'],
  standalone: true,
  imports: [NgxEditorModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EditorComponent implements OnInit, OnDestroy {
  editor: Editor = new Editor();
  html = '';

  ngOnInit(): void {
    this.editor = new Editor();
  }

  // make sure to destory the editor
  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
  }
}