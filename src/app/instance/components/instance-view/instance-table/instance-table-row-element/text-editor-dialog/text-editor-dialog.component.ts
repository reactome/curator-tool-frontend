import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-text-editor-dialog',
  templateUrl: './text-editor-dialog.component.html',
  styleUrls: ['./text-editor-dialog.component.scss']
})
export class TextEditorDialogComponent {

  findText: string = ''; // Text to find
  replaceText: string = ''; // Text to replace with
  highlightedText: string = ''; // Text with highlights
  removeFindText: string = ''; // Keep the last search text that was entered
  findAndReplaceContainer: boolean = false; // Flag to show/hide the find and replace container
  
  constructor(
    public dialogRef: MatDialogRef<TextEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) {
    this.highlightedText = this.data.text; // Initialize highlighted text with the original text
  }

  onCancel(): void {
    this.removeHighlight();
    this.dialogRef.close();
  }

  onOkay(): void {
    this.removeHighlight();
    this.dialogRef.close(this.data.text);
  }

  findAndReplace(): void {
    if (!this.findText) {
      return; // Do nothing if the find text is empty
    }

    const regex = new RegExp(this.findText, 'g'); // Create a global regex for the find text
    this.data.text = this.data.text.replace(regex, this.replaceText); // Replace all occurrences
    this.highlightMatches(); // Highlight the matches after replacement
  }

  highlightMatches(): void {
    if (!this.findText) {
      this.highlightedText = this.data.text; // Reset to original text if no search term
      return;
    }

    this.removeHighlight();

    const regex = new RegExp(`(${this.escapeRegExp(this.findText)})`, 'gi'); // Create a regex to match the search term
    this.data.text = this.data.text.replace(
      regex,
      '<mark class="highlight">$1</mark>' // Wrap matches in a span with a highlight class
    );
    let textArea = document.getElementById('editor'); // Reference to the text area element
    let pre = document.getElementById('highlighting'); // Reference to the pre element

    this.syncScroll(textArea!, pre!); // Sync scroll positions
  }

  removeHighlight(): void {
    const regex = new RegExp(`(${this.escapeRegExp('<mark class="highlight">' + this.removeFindText + '</mark>' )})`, 'gi'); // Create a regex to match the search term
    this.data.text = this.data.text.replace(
      regex,
      this.removeFindText
      // Wrap matches in a span with a highlight class
    );

    this.removeFindText = this.findText
  }

  private escapeRegExp(text: string): string {
    // Escape special characters for use in a regular expression
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  syncScroll(editor: HTMLElement, pre: HTMLElement) {
      pre.scrollTop = editor.scrollTop;
      pre.scrollLeft = editor.scrollLeft;
    
  }

  showFindAndReplace() {
    this.findAndReplaceContainer = !this.findAndReplaceContainer; // Toggle the visibility of the find and replace container
    }

  onEditorChange($event: any) {
    this.data.text = $event.html; // Update the data text with the editor's HTML content
    this.highlightMatches(); // Highlight matches after any change}
}

editorConfig: AngularEditorConfig = {
  editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      {class: 'arial', name: 'Arial'},
      {class: 'times-new-roman', name: 'Times New Roman'},
      {class: 'calibri', name: 'Calibri'},
      {class: 'comic-sans-ms', name: 'Comic Sans MS'}
    ],
    customClasses: [
    {
      name: 'quote',
      class: 'quote',
    },
    {
      name: 'redText',
      class: 'redText'
    },
    {
      name: 'titleText',
      class: 'titleText',
      tag: 'h1',
    },
  ],
  uploadUrl: 'v1/image',
  // upload: (file: File) => { ... }
  uploadWithCredentials: false,
  sanitize: true,
  toolbarPosition: 'top',
  toolbarHiddenButtons: [
    ['bold', 'italic'],
    ['fontSize']
  ]
};

config: AngularEditorConfig = {
  editable: true,
  spellcheck: true,
  height: '15rem',
  minHeight: '5rem',
  placeholder: 'Enter text here...',
  translate: 'no',
  defaultParagraphSeparator: 'p',
  defaultFontName: 'Arial',
  toolbarHiddenButtons: [
    ['bold']
    ],
  customClasses: [
    {
      name: "quote",
      class: "quote",
    },
    {
      name: 'redText',
      class: 'redText'
    },
    {
      name: "titleText",
      class: "titleText",
      tag: "h1",
    },
  ]
};
}
